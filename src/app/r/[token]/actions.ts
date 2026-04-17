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
    // Resurrect unsubscribed/bounced, no-op if already active/pending
    if (existing.status === "active") {
      return {
        ok: true,
        message: "이미 구독 중인 이메일입니다. 감사합니다.",
      };
    }
    await supabase
      .from("recipients")
      .update({
        status: "active",
        unsubscribed_at: null,
        unsubscribe_reason: null,
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

  // Insert new recipient
  const { data: inserted, error } = await supabase
    .from("recipients")
    .insert({
      email: parsed.data.email,
      name: parsed.data.name,
      organization: parsed.data.organization,
      status: "active",
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
    message: "구독 신청이 완료되었습니다. 감사합니다!",
  };
}
