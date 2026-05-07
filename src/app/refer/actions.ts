"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { enqueueAddRequest } from "@/lib/ncp-sync/queue";

export type ReferralSignupResult =
  | {
      ok: true;
      status: "queued" | "already_pending";
      email: string;
    }
  | { ok: false; error: string };

/**
 * Token-less referral signup used by the generic /refer page.
 *
 * 본 콘솔은 추천 가입 신청을 NCP 동기화 큐(`ncp_sync_requests`)로만 흘려보내고,
 * 실제 NCP 주소록 반영은 관리자가 수기로 처리한다. `recipients` 테이블은
 * 절대 건드리지 않으며, 가입자가 우리 콘솔의 메인 수신자 리스트에 자동으로
 * 들어가는 일은 없다.
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

  const enq = await enqueueAddRequest(supabase, {
    email,
    name,
    sourceKind: "referral_self",
  });

  if (enq.error) {
    return { ok: false, error: enq.error };
  }

  await logAudit({
    adminId: null,
    action: enq.inserted
      ? "ncp_sync.add_request_queued"
      : "ncp_sync.add_request_duplicate",
    entity: "ncp_sync_request",
    metadata: { email, source: "referral_self" },
  });

  revalidatePath("/ncp-sync");

  return {
    ok: true,
    status: enq.inserted ? "queued" : "already_pending",
    email,
  };
}
