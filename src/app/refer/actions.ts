"use server";

import { revalidatePath } from "next/cache";
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
 *
 * Self-signups land in `recipients` with `status='pending'` and
 * `source='referral'` — they're intentionally hidden from the default
 * `/recipients` listing and only appear in the NCP 추가 대기 큐on
 * `/ncp-sync`, where the admin reviews + promotes them to 'active'
 * via the '처리 완료' action.
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
    if (existing.status === "active" || existing.status === "pending") {
      // 이미 활성 구독자거나, 이미 NCP 처리 대기 중인 경우 동일 메시지로 안내
      return { ok: true, status: "already_active", email };
    }
    // 과거 unsubscribed/bounced 였던 주소가 다시 신청 — pending 으로 재진입시켜
    // 관리자가 NCP 동기화에서 다시 검토 후 승격하도록 함.
    const { error } = await supabase
      .from("recipients")
      .update({
        status: "pending",
        unsubscribed_at: null,
        unsubscribe_reason: null,
        // 새로운 NCP 추가 대기로 다시 큐에 올리기 위해 두 타임스탬프 모두 초기화
        ncp_added_at: null,
        ncp_removed_at: null,
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

    revalidatePath("/ncp-sync");
    revalidatePath("/recipients");
    return { ok: true, status: "reactivated", email };
  }

  // 신규 가입 — 'pending' 상태로 들어가서 /recipients 메인 리스트엔 노출되지 않고
  // /ncp-sync 의 NCP 추가 큐에서 관리자가 수동으로 승격(처리 완료)할 때까지 대기.
  const { data: inserted, error } = await supabase
    .from("recipients")
    .insert({
      email,
      name,
      status: "pending",
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

  revalidatePath("/ncp-sync");
  revalidatePath("/recipients");
  return { ok: true, status: "created", email };
}
