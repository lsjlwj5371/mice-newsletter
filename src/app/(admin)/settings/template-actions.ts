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

  const { error } = await supabase
    .from("template_settings")
    .upsert(
      {
        id: "default",
        header: input.header,
        referral_cta: input.referralCta,
        footer: input.footer,
        updated_at: new Date().toISOString(),
        updated_by: admin.id,
      },
      { onConflict: "id" }
    );
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAudit({
    adminId: admin.id,
    action: "template.update",
    entity: "template_settings",
    entityId: "default",
    metadata: {
      industryTag: input.header.industryTag,
      linkCount: input.footer.links.length,
    },
  });

  revalidatePath("/settings");
  return { ok: true, message: "저장되었습니다." };
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
