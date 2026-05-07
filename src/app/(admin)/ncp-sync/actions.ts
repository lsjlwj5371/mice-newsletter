"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export type ActionResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/**
 * Mark a batch of recipients as "added to NCP address book". Sets
 * ncp_added_at=NOW() on the given IDs so they drop out of the "NCP
 * 추가 대기" 큐. 동시에 status='pending' 행은 'active' 로 승격하여
 * /recipients 메인 리스트에 정식 노출되도록 한다 (자기-구독 가입자가
 * 관리자 검토를 거쳐 정식 구독자가 되는 시점).
 */
export async function markNcpAddedAction(
  recipientIds: string[]
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
    return { ok: false, error: "선택된 수신자가 없습니다." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("recipients")
    .update({
      ncp_added_at: new Date().toISOString(),
      // pending 이었던 자기-구독 가입자를 active 로 승격. 이미 active 인 행은 멱등.
      status: "active",
    })
    .in("id", recipientIds)
    .is("ncp_added_at", null)
    .select("id");

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminId: admin.id,
    action: "recipient.ncp_added",
    entity: "recipient",
    metadata: { count: data?.length ?? 0, ids: recipientIds },
  });

  revalidatePath("/ncp-sync");
  return { ok: true, count: data?.length ?? 0 };
}

/**
 * Mark a batch of recipients as "removed from NCP address book". Sets
 * ncp_removed_at=NOW() so they drop out of the "NCP 제거 대기" queue.
 */
export async function markNcpRemovedAction(
  recipientIds: string[]
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
    return { ok: false, error: "선택된 수신자가 없습니다." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("recipients")
    .update({ ncp_removed_at: new Date().toISOString() })
    .in("id", recipientIds)
    .is("ncp_removed_at", null)
    .select("id");

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminId: admin.id,
    action: "recipient.ncp_removed",
    entity: "recipient",
    metadata: { count: data?.length ?? 0, ids: recipientIds },
  });

  revalidatePath("/ncp-sync");
  return { ok: true, count: data?.length ?? 0 };
}
