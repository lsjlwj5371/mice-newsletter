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
 * 추가 대기" queue.
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
    .update({ ncp_added_at: new Date().toISOString() })
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
