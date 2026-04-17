import { getGmailClient } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Scan the sender's Gmail inbox for bounce notifications and mark the
 * corresponding recipients as 'bounced'.
 *
 * Gmail bounce ("delivery status notification") emails:
 *   - From: mailer-daemon@googlemail.com (or mailer-daemon@<sender-domain>)
 *   - Subject: Delivery Status Notification (Failure)
 *   - Body contains the failed recipient address in the form:
 *       Recipient address rejected: <email>
 *     or includes "The email account that you tried to reach does not exist"
 *
 * We use Gmail search to narrow the window to bounces received since the
 * last scan, then pull each matching message's text and extract the
 * failed recipient email.
 */

export interface BounceScanResult {
  scanned: number;
  matched: number;
  marked_bounced: number;
  skipped_not_found: number;
  errors: string[];
}

const BOUNCE_FROM_QUERY =
  'from:mailer-daemon OR subject:"Delivery Status Notification"';

export async function scanAndMarkBounces(options: {
  /** Maximum Gmail threads to fetch. Default 50. */
  maxResults?: number;
  /** Only scan messages received after this ISO time. Default 7 days ago. */
  sinceIso?: string;
}): Promise<BounceScanResult> {
  const gmail = getGmailClient();
  const supabase = createAdminClient();
  const maxResults = options.maxResults ?? 50;
  const since = options.sinceIso
    ? new Date(options.sinceIso)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const result: BounceScanResult = {
    scanned: 0,
    matched: 0,
    marked_bounced: 0,
    skipped_not_found: 0,
    errors: [],
  };

  // Gmail search uses epoch seconds for after: operator
  const afterSec = Math.floor(since.getTime() / 1000);
  const query = `${BOUNCE_FROM_QUERY} after:${afterSec}`;

  let listRes;
  try {
    listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`list failed: ${msg}`);
    return result;
  }

  const messages = listRes.data.messages ?? [];
  result.scanned = messages.length;

  for (const msg of messages) {
    if (!msg.id) continue;
    try {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      // Collect all text parts into a single blob
      const body = extractPlainText(detail.data.payload);
      if (!body) continue;

      const emails = extractFailedAddresses(body);
      if (emails.length === 0) continue;

      result.matched++;

      for (const email of emails) {
        const { data: rec } = await supabase
          .from("recipients")
          .select("id, status")
          .ilike("email", email)
          .maybeSingle();

        if (!rec) {
          result.skipped_not_found++;
          continue;
        }
        if (rec.status === "bounced" || rec.status === "unsubscribed") {
          // Already handled; don't re-mark
          continue;
        }

        await supabase
          .from("recipients")
          .update({
            status: "bounced",
            unsubscribed_at: new Date().toISOString(),
            unsubscribe_reason: "auto_bounce",
          })
          .eq("id", rec.id);

        // Also flag any pending sends for this recipient so the queue
        // skips them
        await supabase
          .from("sends")
          .update({
            status: "bounced",
            bounced_at: new Date().toISOString(),
            error: "auto-detected bounce from Gmail DSN",
          })
          .eq("recipient_id", rec.id)
          .in("status", ["queued", "sending", "sent"]);

        result.marked_bounced++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`msg ${msg.slice(0, 100)}`);
    }
  }

  return result;
}

/**
 * Walk a Gmail payload tree and concat all text/plain parts. Falls back
 * to text/html with tags stripped.
 */
function extractPlainText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const parts: string[] = [];

  function walk(p: {
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  }) {
    if (p.body?.data) {
      const decoded = Buffer.from(
        p.body.data.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf8");
      if (p.mimeType === "text/plain") {
        parts.push(decoded);
      } else if (p.mimeType === "text/html") {
        parts.push(decoded.replace(/<[^>]+>/g, " "));
      }
    }
    if (Array.isArray(p.parts)) {
      for (const child of p.parts) {
        walk(child as typeof p);
      }
    }
  }

  walk(payload as Parameters<typeof walk>[0]);
  return parts.join("\n");
}

/**
 * Pull failed recipient email addresses from a Gmail bounce body.
 *
 * Gmail DSN bodies typically include patterns like:
 *   The email account that you tried to reach does not exist. ...
 *   <foo@example.com>
 *
 * or
 *
 *   Original-Recipient: rfc822;foo@example.com
 *   Final-Recipient: rfc822;foo@example.com
 *   Recipient address rejected: foo@example.com
 *
 * We look for "Final-Recipient: rfc822;" first (most reliable), then
 * fall back to common phrases. Returns a deduped list.
 */
function extractFailedAddresses(body: string): string[] {
  const emails = new Set<string>();

  // 1) Final-Recipient / Original-Recipient: rfc822;<email>
  const rfcMatches = body.matchAll(
    /(?:Final-Recipient|Original-Recipient):\s*rfc822;\s*([^\s;<>]+@[^\s;<>]+)/gi
  );
  for (const m of rfcMatches) {
    emails.add(m[1].trim().toLowerCase());
  }

  // 2) "Recipient address rejected: <email>"
  const rejectedMatches = body.matchAll(
    /Recipient address rejected:\s*([^\s;<>]+@[^\s;<>]+)/gi
  );
  for (const m of rejectedMatches) {
    emails.add(m[1].trim().toLowerCase());
  }

  // 3) Angle-bracketed addresses near the phrase "does not exist"
  if (/does not exist|user unknown|address not found/i.test(body)) {
    const angled = body.matchAll(/<([^\s<>]+@[^\s<>]+)>/g);
    for (const m of angled) {
      emails.add(m[1].trim().toLowerCase());
    }
  }

  return Array.from(emails);
}
