import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append an audit log entry. Failures are swallowed and logged to console
 * so audit logging never breaks the calling request.
 */
export async function logAudit(params: {
  adminId: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from("audit_logs").insert({
      admin_id: params.adminId,
      action: params.action,
      entity: params.entity ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write log", err);
  }
}
