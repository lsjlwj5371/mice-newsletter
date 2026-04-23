"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export type ReferralSignupResult =
  | {
      ok: true;
      status: "created" | "already_active" | "reactivated";
      email: string;
    }
  | { ok: false; error: string };

/**
 * Token-less referral signup used by the generic /refer page.
 *
 * When the newsletter HTML is exported for a third-party sender (e.g.
 * Naver Cloud), the per-recipient {{REFERRAL_HREF}} token is not
 * substituted, so we can't tell which subscriber invited the new
 * person. This path records the signup without referrer attribution.
 * The record lands in `recipients` with `source='referral'` and a
 * default status so the admin can review + add to the NCP address
 * book from the NCP 동기화 page.
 */
export async function selfReferralSignupAction(
  emailRaw: string,
  nameRaw: string
): Promise<ReferralSignupResult> {
  const email = emailRaw.trim().toLowerCase();
  const name = nameRaw.trim() || null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "올바른 이메일 형식이 아닙니다." };
  }

  const supabase = createAdminClient();

  // Existing recipient?
  const { data: existing } = await supabase
    .from("recipients")
    .select("id, email, status")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    if (existing.status === "active") {
      return { ok: true, status: "already_active", email };
    }
    // Reactivate a previously unsubscribed/bounced/pending address
    const { error } = await supabase
      .from("recipients")
      .update({
        status: "active",
        unsubscribed_at: null,
        unsubscribe_reason: null,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };

    await logAudit({
      adminId: null,
      action: "recipient.self_reactivate",
      entity: "recipient",
      entityId: existing.id,
      metadata: { email, via: "token_less_refer_form" },
    });

    return { ok: true, status: "reactivated", email };
  }

  // Fresh signup
  const { data: inserted, error } = await supabase
    .from("recipients")
    .insert({
      email,
      name,
      status: "active",
      source: "referral",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminId: null,
    action: "recipient.self_signup",
    entity: "recipient",
    entityId: inserted?.id,
    metadata: { email, via: "token_less_refer_form" },
  });

  return { ok: true, status: "created", email };
}
