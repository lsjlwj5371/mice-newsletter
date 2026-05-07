"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export type ActionResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/**
 * NCP 추가 요청을 '처리 완료' 로 마킹.
 *
 * 큐 테이블(`ncp_sync_requests`)에서 request_type='add' 이고 아직 대기 중인
 * (completed_at IS NULL) 행만 골라 completed_at / completed_by 를 채운다.
 * 이미 완료된 행은 멱등 처리(매칭에서 빠짐).
 */
export async function markNcpAddedAction(
  requestIds: string[]
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return { ok: false, error: "선택된 항목이 없습니다." };
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("ncp_sync_requests")
    .update({
      completed_at: nowIso,
      completed_by: admin.id,
    })
    .in("id", requestIds)
    .eq("request_type", "add")
    .is("completed_at", null)
    .select("id");

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminId: admin.id,
    action: "ncp_sync.mark_added",
    entity: "ncp_sync_request",
    metadata: { count: data?.length ?? 0, ids: requestIds },
  });

  revalidatePath("/ncp-sync");
  return { ok: true, count: data?.length ?? 0 };
}

/**
 * NCP 제거 요청을 '처리 완료' 로 마킹.
 */
export async function markNcpRemovedAction(
  requestIds: string[]
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return { ok: false, error: "선택된 항목이 없습니다." };
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("ncp_sync_requests")
    .update({
      completed_at: nowIso,
      completed_by: admin.id,
    })
    .in("id", requestIds)
    .eq("request_type", "remove")
    .is("completed_at", null)
    .select("id");

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminId: admin.id,
    action: "ncp_sync.mark_removed",
    entity: "ncp_sync_request",
    metadata: { count: data?.length ?? 0, ids: requestIds },
  });

  revalidatePath("/ncp-sync");
  return { ok: true, count: data?.length ?? 0 };
}
