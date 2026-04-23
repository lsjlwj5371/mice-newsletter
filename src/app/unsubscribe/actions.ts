"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export type UnsubscribeResult =
  | { ok: true; status: "unsubscribed" | "already" | "not_found"; email: string }
  | { ok: false; error: string };

/**
 * Token-less unsubscribe handler used by the generic /unsubscribe page.
 * Recipients arrive here when the newsletter HTML was sent through a
 * third-party (e.g. Naver Cloud) that could not substitute the
 * {{UNSUBSCRIBE_HREF}} per-recipient token. They type their own email;
 * we update recipients.status if we find a match.
 */
export async function unsubscribeByEmailAction(
  emailRaw: string
): Promise<UnsubscribeResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "올바른 이메일 형식이 아닙니다." };
  }

  const supabase = createAdminClient();
  const { data: recipient } = await supabase
    .from("recipients")
    .select("id, email, status")
    .ilike("email", email)
    .maybeSingle();

  if (!recipient) {
    return { ok: true, status: "not_found", email };
  }

  if (recipient.status === "unsubscribed") {
    return { ok: true, status: "already", email };
  }

  const { error } = await supabase
    .from("recipients")
    .update({
      status: "unsubscribed",
      unsubscribed_at: new Date().toISOString(),
      unsubscribe_reason: "self_form",
    })
    .eq("id", recipient.id);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminId: null,
    action: "recipient.self_unsubscribe",
    entity: "recipient",
    entityId: recipient.id,
    metadata: { email, via: "token_less_form" },
  });

  return { ok: true, status: "unsubscribed", email };
}
