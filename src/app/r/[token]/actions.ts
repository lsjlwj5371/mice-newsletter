"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { verifyReferralToken } from "@/lib/referral-token";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const submitSchema = z.object({
  token: z.string().min(1),
  email: z
    .string()
    .email("이메일 형식이 올바르지 않습니다")
    .transform((v) => v.trim().toLowerCase()),
  name: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
  organization: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
});

export async function submitReferralAction(
  input: z.input<typeof submitSchema>
): Promise<ActionResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const claims = verifyReferralToken(parsed.data.token);
  if (!claims) {
    return {
      ok: false,
      error: "추천 링크가 유효하지 않습니다. 추천자에게 다시 요청해 주세요.",
    };
  }

  const supabase = createAdminClient();

  // Check for existing recipient
  const { data: existing } = await supabase
    .from("recipients")
    .select("id, status")
    .ilike("email", parsed.data.email)
    .maybeSingle();

  if (existing) {
    // 이미 active 또는 pending 이면 추가 처리 없이 안내만
    if (existing.status === "active" || existing.status === "pending") {
      return {
        ok: true,
        message: "이미 구독 신청된 이메일입니다. 감사합니다.",
      };
    }
    // 과거 unsubscribed/bounced 였던 주소가 다시 신청 — pending 으로 재진입시켜
    // 관리자가 NCP 동기화에서 다시 검토 후 승격하도록 함.
    await supabase
      .from("recipients")
      .update({
        status: "pending",
        unsubscribed_at: null,
        unsubscribe_reason: null,
        ncp_added_at: null,
        ncp_removed_at: null,
        // Keep name/organization if already stored — only fill blanks
      })
      .eq("id", existing.id);

    await logAudit({
      adminId: null,
      action: "recipient.resubscribe_via_referral",
      entity: "recipient",
      entityId: existing.id,
      metadata: {
        email: parsed.data.email,
        referredBy: claims.referrerRecipientId ?? null,
      },
    });

    return {
      ok: true,
      message: "재구독이 완료되었습니다.",
    };
  }

  // 신규 가입 — 'pending' 상태로 들어가 NCP 추가 큐에서 관리자 승격 대기.
  // /recipients 기본 리스트엔 노출되지 않음.
  const { data: inserted, error } = await supabase
    .from("recipients")
    .insert({
      email: parsed.data.email,
      name: parsed.data.name,
      organization: parsed.data.organization,
      status: "pending",
      source: "referral",
      referred_by: claims.referrerRecipientId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: `저장 실패: ${error.message}` };
  }

  await logAudit({
    adminId: null,
    action: "recipient.referral_signup",
    entity: "recipient",
    entityId: inserted.id,
    metadata: {
      email: parsed.data.email,
      referredBy: claims.referrerRecipientId ?? null,
    },
  });

  return {
    ok: true,
    message: "구독 신청이 접수되었습니다. 관리자 확인 후 발송 대상에 반영됩니다.",
  };
}
