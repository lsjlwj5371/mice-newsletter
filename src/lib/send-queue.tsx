import { render } from "@react-email/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import Newsletter from "@/emails/Newsletter";
import { sendEmail } from "@/lib/gmail/send";
import { signToken, unsubscribeUrl } from "@/lib/tokens";
import { signReferralToken } from "@/lib/referral-token";
import { injectTracking } from "@/lib/tracking-inject";
import { inlineStorageImages } from "@/lib/image-inline";
import { newsletterContentSchema } from "@/lib/validation/newsletter-content";
import type { NewsletterRow } from "@/types/newsletter";

export interface ProcessOptions {
  supabase: SupabaseClient;
  /** If provided, only process this specific newsletter's queue. */
  newsletterId?: string;
  /** Hard deadline in ms since epoch. Stop claiming new rows after this. */
  deadlineMs: number;
}

export interface ProcessResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  /** True if we ran out of time and some rows remain queued. */
  hitDeadline: boolean;
}

/**
 * Drain the send queue for one newsletter (or all), up to the deadline.
 *
 * Flow per row:
 *   1. Claim row (queued → sending) via conditional UPDATE
 *   2. Skip if recipient is now unsubscribed/bounced
 *   3. Render HTML with the recipient's personalized unsubscribe URL
 *   4. Call Gmail API
 *   5. Mark sent / failed
 *
 * Each Gmail send averages ~1.5-3s; we target ≤25 per invocation to
 * stay well under Vercel's 60s function limit. Remaining rows are
 * picked up by the next cron tick.
 */
const PER_INVOCATION_LIMIT = 25;

export async function processSendQueue({
  supabase,
  newsletterId,
  deadlineMs,
}: ProcessOptions): Promise<ProcessResult> {
  const stats: ProcessResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    hitDeadline: false,
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const fromEmail =
    process.env.GOOGLE_SENDER_EMAIL ?? "no-reply@example.com";
  const fromName = process.env.GOOGLE_SENDER_NAME ?? "PIK by GroundK";

  // Cache of rendered HTML per newsletter (so mass-send for the same
  // newsletter only renders once).
  const htmlCache = new Map<string, { html: string; subject: string }>();

  for (let i = 0; i < PER_INVOCATION_LIMIT; i++) {
    if (Date.now() > deadlineMs - 5000) {
      stats.hitDeadline = true;
      break;
    }

    // Claim a queued row atomically. Supabase doesn't support FOR
    // UPDATE SKIP LOCKED over REST, so we do a "claim by conditional
    // update" pattern: fetch one queued row, then update it only if
    // still queued.
    let query = supabase
      .from("sends")
      .select("*")
      .eq("status", "queued")
      .order("queued_at", { ascending: true })
      .limit(1);

    if (newsletterId) {
      query = query.eq("newsletter_id", newsletterId);
    }

    const { data: pickedList, error: pickErr } = await query;
    if (pickErr) {
      console.error("[send-queue] pick error", pickErr);
      break;
    }
    const picked = pickedList?.[0];
    if (!picked) break; // queue empty

    const { data: claimed, error: claimErr } = await supabase
      .from("sends")
      .update({ status: "sending", attempt_count: picked.attempt_count + 1 })
      .eq("id", picked.id)
      .eq("status", "queued") // only claim if still queued
      .select()
      .single();

    if (claimErr || !claimed) {
      // Lost the race to another worker; try next
      continue;
    }

    stats.attempted++;

    // Skip if recipient was unsubscribed/bounced since queuing
    if (claimed.recipient_id) {
      const { data: rec } = await supabase
        .from("recipients")
        .select("status")
        .eq("id", claimed.recipient_id)
        .single();
      if (rec && rec.status !== "active") {
        await supabase
          .from("sends")
          .update({ status: "skipped", error: `recipient status=${rec.status}` })
          .eq("id", claimed.id);
        stats.skipped++;
        continue;
      }
    }

    // Load + render newsletter html once per newsletter
    let cached = htmlCache.get(claimed.newsletter_id);
    if (!cached) {
      const { data: nlRow, error: nlErr } = await supabase
        .from("newsletters")
        .select("*")
        .eq("id", claimed.newsletter_id)
        .single();
      if (nlErr || !nlRow) {
        await supabase
          .from("sends")
          .update({
            status: "failed",
            error: `newsletter load failed: ${nlErr?.message}`,
          })
          .eq("id", claimed.id);
        stats.failed++;
        continue;
      }
      const newsletter = nlRow as NewsletterRow;
      const parsed = newsletterContentSchema.safeParse(newsletter.content_json);
      if (!parsed.success) {
        await supabase
          .from("sends")
          .update({
            status: "failed",
            error: "content_json failed schema validation",
          })
          .eq("id", claimed.id);
        stats.failed++;
        continue;
      }
      // Render with a placeholder unsubscribe href; we replace per-send
      const htmlTemplate = await render(
        <Newsletter content={parsed.data} appUrl={appUrl} />,
        { pretty: false }
      );
      cached = { html: htmlTemplate, subject: parsed.data.subject };
      htmlCache.set(claimed.newsletter_id, cached);
    }

    // Build a per-recipient referral URL so each subscriber's "추천하기"
    // button attributes their invites back to them. `signReferralToken`
    // embeds the recipient_id in a signed payload that `/r/[token]` reads
    // server-side when the invite is accepted.
    const referralHref = `${appUrl}/r/${signReferralToken(
      claimed.recipient_id ?? null
    )}`;

    const personalizedHtml = cached.html
      .replaceAll(
        "{{UNSUBSCRIBE_HREF}}",
        unsubscribeUrl(claimed.id, claimed.recipient_email, appUrl)
      )
      .replaceAll("{{REFERRAL_HREF}}", referralHref);
    // Wrap all external links for click tracking and append the open
    // pixel. Skip for test sends so we don't pollute open/click stats.
    const trackedHtml = claimed.is_test
      ? personalizedHtml
      : injectTracking({
          html: personalizedHtml,
          sendId: claimed.id,
          email: claimed.recipient_email,
          appUrl,
        });

    // Inline Storage-hosted images as base64 data URIs so the email is
    // self-contained and we can later delete the Storage originals. The
    // external logo on /public stays as a URL (served by Vercel forever).
    let finalHtml = trackedHtml;
    let inlinedStoragePaths: string[] = [];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && !claimed.is_test) {
      try {
        const inlineResult = await inlineStorageImages({
          html: trackedHtml,
          supabaseUrl,
          bucket: "newsletter-images",
        });
        finalHtml = inlineResult.html;
        inlinedStoragePaths = inlineResult.inlinedStoragePaths;
      } catch (err) {
        // Inlining is best-effort — fall through to the URL-linked HTML
        console.error("[send-queue] image inline failed", err);
      }
    }

    try {
      const unsubToken = signToken({
        sendId: claimed.id,
        email: claimed.recipient_email,
        kind: "u",
      });
      const res = await sendEmail({
        to: claimed.recipient_email,
        toName: claimed.recipient_name ?? null,
        fromEmail,
        fromName,
        subject: cached.subject,
        html: finalHtml,
        unsubscribeUrl: unsubscribeUrl(
          claimed.id,
          claimed.recipient_email,
          appUrl
        ),
        unsubscribePostUrl: `${appUrl}/api/unsubscribe/${unsubToken}`,
        messageIdPrefix: `nl-${claimed.newsletter_id.slice(0, 8)}`,
      });

      await supabase
        .from("sends")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          gmail_message_id: res.messageId,
          error: null,
        })
        .eq("id", claimed.id);

      // Mark storage images as inlined so the cleanup cron knows it's
      // safe to delete the original blobs after a 7-day retention.
      if (inlinedStoragePaths.length > 0) {
        await supabase
          .from("image_assets")
          .update({ inlined_at: new Date().toISOString() })
          .in("path", inlinedStoragePaths)
          .is("inlined_at", null);
      }

      stats.sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("sends")
        .update({ status: "failed", error: msg.slice(0, 500) })
        .eq("id", claimed.id);
      stats.failed++;
    }
  }

  return stats;
}
