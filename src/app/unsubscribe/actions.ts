"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { enqueueRemoveRequest } from "@/lib/ncp-sync/queue";

export type UnsubscribeResult =
  | { ok: true; status: "queued" | "already_pending"; email: string }
  | { ok: false; error: string };

/**
 * Token-less unsubscribe handler used by the generic /unsubscribe page.
 *
 * 본 콘솔은 외부 사용자의 수신 거부를 NCP 동기화 큐(`ncp_sync_requests`)로만
 * 기록하고, 실제 NCP 주소록 반영은 관리자가 수기로 처리한다. recipients
 * 테이블은 절대 건드리지 않는다 — 사용자 해지가 우리 콘솔의 메인 수신자
 * 리스트(관리자 전용)에 영향을 미칠 가능성을 코드 레벨에서 봉쇄.
 */
export async function unsubscribeByEmailAction(
  emailRaw: string
): Promise<UnsubscribeResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "올바른 이메일 형식이 아닙니다." };
  }

  const supabase = createAdminClient();

  const enq = await enqueueRemoveRequest(supabase, {
    email,
    sourceKind: "self_form",
  });

  if (enq.error) {
    return { ok: false, error: enq.error };
  }

  await logAudit({
    adminId: null,
    action: enq.inserted
      ? "ncp_sync.remove_request_queued"
      : "ncp_sync.remove_request_duplicate",
    entity: "ncp_sync_request",
    metadata: { email, source: "self_form" },
  });

  revalidatePath("/ncp-sync");
  return {
    ok: true,
    status: enq.inserted ? "queued" : "already_pending",
    email,
  };
}
