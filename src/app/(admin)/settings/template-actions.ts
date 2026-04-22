"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { loadTemplateSettings } from "@/lib/template-settings";
import type {
  HeaderContent,
  ReferralCtaContent,
  FooterContent,
} from "@/types/newsletter";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export interface UpdateTemplateInput {
  header: {
    wordmark: string;
    tagline: string;
    industryTag: string;
    description: string;
    /** Optional — when null/undefined, the renderer auto-scales by
     *  wordmark length. */
    wordmarkFontSize?: number | null;
    wordmarkColor?: string | null;
    wordmarkFontWeight?: number | null;
    wordmarkLetterSpacing?: number | null;
    /** When set, header renders this image instead of text wordmark. */
    wordmarkLogoUrl?: string | null;
    wordmarkLogoHeight?: number | null;
  };
  referralCta: {
    message: string;
    buttonLabel: string;
    buttonHref: string;
  };
  footer: {
    brandName: string;
    brandTagline: string;
    links: Array<{ label: string; href: string }>;
    unsubscribeHref: string;
    /** Footer logo image URL. Empty/null → falls back to /logo.png. */
    logoSrc?: string | null;
    logoWidth?: number | null;
    /** Click-through URLs for the two circular footer logos. */
    miceLogoHref?: string | null;
    groundkLogoHref?: string | null;
  };
}

/**
 * Upsert the singleton template_settings row (id='default'). Replaces
 * every admin-editable field in one shot — simpler than a patch API and
 * keeps the form semantics obvious.
 *
 * `buttonHref`/`unsubscribeHref` keep their {{…}} placeholder tokens
 * intact; they're resolved per-recipient at send time.
 */
export async function updateTemplateSettingsAction(
  input: UpdateTemplateInput
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Basic validation — reject empty wordmark / buttonLabel which would
  // produce a broken hero. All other fields may be blank.
  if (!input.header.wordmark.trim()) {
    return { ok: false, error: "워드마크는 비워둘 수 없습니다." };
  }
  if (!input.referralCta.buttonLabel.trim()) {
    return { ok: false, error: "추천 CTA 버튼 라벨은 비워둘 수 없습니다." };
  }
  if (input.footer.links.length > 10) {
    return { ok: false, error: "푸터 링크는 최대 10개까지 허용됩니다." };
  }
  for (const l of input.footer.links) {
    if (!l.label.trim() || !l.href.trim()) {
      return { ok: false, error: "푸터 링크의 라벨과 URL은 모두 필요합니다." };
    }
  }

  // Strip optional style fields when empty/null so they don't clutter the
  // JSON and the renderer's auto-scaling + default color kick in.
  const cleanedHeader: Record<string, unknown> = {
    wordmark: input.header.wordmark,
    tagline: input.header.tagline,
    industryTag: input.header.industryTag,
    description: input.header.description,
  };
  if (
    input.header.wordmarkFontSize !== null &&
    input.header.wordmarkFontSize !== undefined
  ) {
    cleanedHeader.wordmarkFontSize = input.header.wordmarkFontSize;
  }
  if (
    input.header.wordmarkColor !== null &&
    input.header.wordmarkColor !== undefined &&
    input.header.wordmarkColor.trim() !== ""
  ) {
    cleanedHeader.wordmarkColor = input.header.wordmarkColor.trim();
  }
  if (
    input.header.wordmarkFontWeight !== null &&
    input.header.wordmarkFontWeight !== undefined
  ) {
    cleanedHeader.wordmarkFontWeight = input.header.wordmarkFontWeight;
  }
  if (
    input.header.wordmarkLetterSpacing !== null &&
    input.header.wordmarkLetterSpacing !== undefined
  ) {
    cleanedHeader.wordmarkLetterSpacing = input.header.wordmarkLetterSpacing;
  }
  if (
    input.header.wordmarkLogoUrl !== null &&
    input.header.wordmarkLogoUrl !== undefined &&
    input.header.wordmarkLogoUrl.trim() !== ""
  ) {
    cleanedHeader.wordmarkLogoUrl = input.header.wordmarkLogoUrl.trim();
  }
  if (
    input.header.wordmarkLogoHeight !== null &&
    input.header.wordmarkLogoHeight !== undefined
  ) {
    cleanedHeader.wordmarkLogoHeight = input.header.wordmarkLogoHeight;
  }

  // Footer: strip empty logo fields the same way so clearing the URL
  // restores the default /logo.png fallback.
  const cleanedFooter: Record<string, unknown> = {
    brandName: input.footer.brandName,
    brandTagline: input.footer.brandTagline,
    links: input.footer.links,
    unsubscribeHref: input.footer.unsubscribeHref,
  };
  if (
    input.footer.logoSrc !== null &&
    input.footer.logoSrc !== undefined &&
    input.footer.logoSrc.trim() !== ""
  ) {
    cleanedFooter.logoSrc = input.footer.logoSrc.trim();
  }
  if (
    input.footer.logoWidth !== null &&
    input.footer.logoWidth !== undefined
  ) {
    cleanedFooter.logoWidth = input.footer.logoWidth;
  }
  if (
    input.footer.miceLogoHref !== null &&
    input.footer.miceLogoHref !== undefined &&
    input.footer.miceLogoHref.trim() !== ""
  ) {
    cleanedFooter.miceLogoHref = input.footer.miceLogoHref.trim();
  }
  if (
    input.footer.groundkLogoHref !== null &&
    input.footer.groundkLogoHref !== undefined &&
    input.footer.groundkLogoHref.trim() !== ""
  ) {
    cleanedFooter.groundkLogoHref = input.footer.groundkLogoHref.trim();
  }

  const { error } = await supabase
    .from("template_settings")
    .upsert(
      {
        id: "default",
        header: cleanedHeader,
        referral_cta: input.referralCta,
        footer: cleanedFooter,
        updated_at: new Date().toISOString(),
        updated_by: admin.id,
      },
      { onConflict: "id" }
    );
  if (error) {
    return { ok: false, error: error.message };
  }

  // Propagate the new template to every non-sent draft so admins don't
  // have to re-create drafts after tweaking the template. We preserve
  // per-issue fields (header.issueMeta) — everything else is swapped to
  // the new template values. Sent issues are left untouched so the
  // archive reflects the template at send time.
  const propagated = await propagateTemplateToDrafts(
    supabase,
    cleanedHeader,
    cleanedFooter,
    input
  );

  await logAudit({
    adminId: admin.id,
    action: "template.update",
    entity: "template_settings",
    entityId: "default",
    metadata: {
      industryTag: input.header.industryTag,
      linkCount: input.footer.links.length,
      propagatedDrafts: propagated.count,
      propagationError: propagated.error,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/newsletters");
  revalidatePath("/preview/newsletter");

  const msg =
    propagated.count > 0
      ? `저장되었습니다. 발송 전 초안 ${propagated.count}건에도 새 템플릿이 적용되었습니다.`
      : "저장되었습니다.";
  return { ok: true, message: msg };
}

/**
 * Rewrite `header` / `referralCta` / `footer` on every newsletter row
 * that hasn't been sent yet. Returns the updated count so the caller
 * can surface a "N건 반영됨" message. Swallows errors and returns 0 +
 * error message so the template save itself still succeeds.
 */
async function propagateTemplateToDrafts(
  supabase: ReturnType<typeof createAdminClient>,
  cleanedHeader: Record<string, unknown>,
  cleanedFooter: Record<string, unknown>,
  input: UpdateTemplateInput
): Promise<{ count: number; error?: string }> {
  try {
    const { data: drafts, error: fetchErr } = await supabase
      .from("newsletters")
      .select("id, content_json, status")
      .neq("status", "sent");
    if (fetchErr) {
      return { count: 0, error: fetchErr.message };
    }
    if (!drafts || drafts.length === 0) return { count: 0 };

    let updated = 0;
    for (const d of drafts) {
      const content = d.content_json as {
        header?: { issueMeta?: string } & Record<string, unknown>;
        referralCta?: Record<string, unknown>;
        footer?: Record<string, unknown>;
      } | null;
      if (!content) continue;

      // Preserve this draft's issueMeta (per-issue label like "VOL.01 …").
      // Everything else in the fixed sections is replaced. cleanedHeader
      // already omits unset optional style fields so drafts don't carry
      // stale wordmarkFontSize/color after admin clears them.
      const issueMeta = content.header?.issueMeta ?? "";
      const nextContent = {
        ...content,
        header: {
          ...cleanedHeader,
          issueMeta,
        },
        referralCta: {
          ...input.referralCta,
        },
        footer: {
          ...cleanedFooter,
        },
      };

      const { error: updErr } = await supabase
        .from("newsletters")
        .update({ content_json: nextContent })
        .eq("id", d.id);
      if (!updErr) updated++;
    }
    return { count: updated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { count: 0, error: msg };
  }
}

/**
 * Read action for the settings page. Exposed so client component can call
 * it — loadTemplateSettings is a server util.
 */
export async function getTemplateSettingsAction(): Promise<{
  header: HeaderContent;
  referralCta: ReferralCtaContent;
  footer: FooterContent;
}> {
  await requireAdmin();
  return loadTemplateSettings();
}
