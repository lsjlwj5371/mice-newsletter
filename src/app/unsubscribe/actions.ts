"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export type UnsubscribeResult =
  | { ok: true; status: "unsubscribed" | "already"; email: string }
  | { ok: false; error: string };

/**
 * Token-less unsubscribe handler used by the generic /unsubscribe page.
 *
 * Since all actual sending is done via Naver Cloud — our system has no
 * record of who actually received each newsletter — we don't verify
 * that the submitted email was ever one of ours. Whatever the visitor
 * types, we record as unsubscribed. If the email isn't in our
 * `recipients` table yet, we create a new row with status='unsubscribed'
 * so it still flows into the 'NCP 제거 대기' queue for the admin to
 * action on the NCP side.
 */
export async function unsubscribeByEmailAction(
  emailRaw: string
): Promise<UnsubscribeResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "올바른 이메일 형식이 아닙니다." };
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from("recipients")
    .select("id, email, status")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    if (existing.status === "unsubscribed") {
      // Idempotent — already in the unsub state. Nothing new to sync.
      return { ok: true, status: "already", email };
    }
    const { error } = await supabase
      .from("recipients")
      .update({
        status: "unsubscribed",
        unsubscribed_at: nowIso,
        unsubscribe_reason: "self_form",
        // Clear any prior NCP removal mark so admins see it in the
        // 'NCP 제거 대기' queue again.
        ncp_removed_at: null,
      })
      .eq("id", existing.id);

    if (error) return { ok: false, error: error.message };

    await logAudit({
      adminId: null,
      action: "recipient.self_unsubscribe",
      entity: "recipient",
      entityId: existing.id,
      metadata: { email, via: "token_less_form" },
    });
  } else {
    // Not in our DB yet (sent via Naver Cloud against their address
    // book). Create a stub row so the unsubscribe still lands in the
    // NCP 제거 대기 queue. The row will have no name / organization —
    // the admin only needs the email to remove from NCP.
    const { data: inserted, error } = await supabase
      .from("recipients")
      .insert({
        email,
        status: "unsubscribed",
        source: "manual",
        unsubscribed_at: nowIso,
        unsubscribe_reason: "self_form_unknown",
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    await logAudit({
      adminId: null,
      action: "recipient.self_unsubscribe",
      entity: "recipient",
      entityId: inserted?.id,
      metadata: { email, via: "token_less_form", created_stub: true },
    });
  }

  revalidatePath("/ncp-sync");
  revalidatePath("/recipients");
  return { ok: true, status: "unsubscribed", email };
}
