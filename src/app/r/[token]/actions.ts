"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { verifyReferralToken } from "@/lib/referral-token";
import { enqueueAddRequest } from "@/lib/ncp-sync/queue";

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

/**
 * 추천 토큰(`/r/[token]`) 기반 구독 신청 처리.
 *
 * 본 콘솔은 추천 가입 신청을 NCP 동기화 큐로만 흘려보내고, 실제 NCP 주소록
 * 반영은 관리자가 수기로 처리한다. recipients 테이블은 일절 변경하지 않는다.
 * 추천인 정보는 큐의 `referrer_email` 필드로 보존된다 (해당 추천인이 우리
 * recipients 에 등록되어 있을 때만 — 즉 관리자가 직접 발급한 추천 링크일 때).
 */
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

  // 추천인 이메일을 큐에 함께 기록하기 위해 lookup (있을 때만 — 없으면 NULL).
  let referrerEmail: string | null = null;
  if (claims.referrerRecipientId) {
    const { data: ref } = await supabase
      .from("recipients")
      .select("email")
      .eq("id", claims.referrerRecipientId)
      .maybeSingle();
    referrerEmail = ref?.email ?? null;
  }

  const enq = await enqueueAddRequest(supabase, {
    email: parsed.data.email,
    name: parsed.data.name,
    organization: parsed.data.organization,
    referrerEmail,
    sourceKind: "referral_token",
  });

  if (enq.error) {
    return { ok: false, error: `저장 실패: ${enq.error}` };
  }

  await logAudit({
    adminId: null,
    action: enq.inserted
      ? "ncp_sync.add_request_queued"
      : "ncp_sync.add_request_duplicate",
    entity: "ncp_sync_request",
    metadata: {
      email: parsed.data.email,
      source: "referral_token",
      referrerRecipientId: claims.referrerRecipientId ?? null,
      referrerEmail,
    },
  });

  revalidatePath("/ncp-sync");

  return {
    ok: true,
    message: enq.inserted
      ? "구독 신청이 접수되었습니다. 관리자 확인 후 발송 대상에 반영됩니다."
      : "이미 동일한 이메일로 구독 신청이 접수되어 처리 대기 중입니다.",
  };
}
