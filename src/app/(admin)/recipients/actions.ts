"use server";

import { signReferralToken } from "@/lib/referral-token";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { recipientSchema } from "@/lib/validation/recipient";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function flattenZodError(err: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_root";
    out[key] ??= [];
    out[key].push(issue.message);
  }
  return out;
}

/** Convert FormData to a plain object so zod can parse it. */
function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") obj[k] = v;
  }
  return obj;
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────
export async function createRecipientAction(
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = recipientSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "입력값을 확인해 주세요.",
      fieldErrors: flattenZodError(parsed.error),
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("recipients")
    .insert({
      email: parsed.data.email,
      name: parsed.data.name,
      organization: parsed.data.organization,
      position: parsed.data.position,
      job_function: parsed.data.job_function,
      status: parsed.data.status,
      source: parsed.data.source,
      tags: parsed.data.tags,
      notes: parsed.data.notes,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "이미 등록된 이메일입니다.",
        fieldErrors: { email: ["이미 등록된 이메일입니다."] },
      };
    }
    return { ok: false, error: error.message };
  }

  await logAudit({
    adminId: admin.id,
    action: "recipient.create",
    entity: "recipient",
    entityId: data.id,
    metadata: { email: parsed.data.email },
  });

  revalidatePath("/recipients");
  return { ok: true, id: data.id };
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────
export async function updateRecipientAction(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = recipientSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "입력값을 확인해 주세요.",
      fieldErrors: flattenZodError(parsed.error),
    };
  }

  const supabase = createAdminClient();

  // Determine if status changed to/from unsubscribed to manage timestamp
  const { data: existing } = await supabase
    .from("recipients")
    .select("status")
    .eq("id", id)
    .single();

  const willBeUnsubscribed = parsed.data.status === "unsubscribed";
  const wasUnsubscribed = existing?.status === "unsubscribed";

  const updatePayload: Record<string, unknown> = {
    email: parsed.data.email,
    name: parsed.data.name,
    organization: parsed.data.organization,
    position: parsed.data.position,
    job_function: parsed.data.job_function,
    status: parsed.data.status,
    source: parsed.data.source,
    tags: parsed.data.tags,
    notes: parsed.data.notes,
  };

  if (willBeUnsubscribed && !wasUnsubscribed) {
    updatePayload.unsubscribed_at = new Date().toISOString();
  } else if (!willBeUnsubscribed && wasUnsubscribed) {
    updatePayload.unsubscribed_at = null;
  }

  const { error } = await supabase
    .from("recipients")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "이미 등록된 이메일입니다.",
        fieldErrors: { email: ["이미 등록된 이메일입니다."] },
      };
    }
    return { ok: false, error: error.message };
  }

  await logAudit({
    adminId: admin.id,
    action: "recipient.update",
    entity: "recipient",
    entityId: id,
    metadata: { email: parsed.data.email },
  });

  revalidatePath("/recipients");
  return { ok: true, id };
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────
export async function deleteRecipientAction(
  id: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: target } = await supabase
    .from("recipients")
    .select("email")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("recipients").delete().eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAudit({
    adminId: admin.id,
    action: "recipient.delete",
    entity: "recipient",
    entityId: id,
    metadata: { email: target?.email ?? null },
  });

  revalidatePath("/recipients");
  return { ok: true };
}

// ─────────────────────────────────────────────
// GENERATE REFERRAL URL
// Returns a {APP_URL}/r/{token} link that, when submitted, attributes
// the new signup to `referrerId`.
// ─────────────────────────────────────────────
export async function generateReferralUrlAction(
  referrerId: string | null
): Promise<ActionResult & { url?: string }> {
  const admin = await requireAdmin();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return { ok: false, error: "NEXT_PUBLIC_APP_URL 환경변수가 설정되지 않았습니다." };
  }

  // Verify the referrer exists if one was passed
  if (referrerId) {
    const supabase = createAdminClient();
    const { data: rec } = await supabase
      .from("recipients")
      .select("id")
      .eq("id", referrerId)
      .maybeSingle();
    if (!rec) {
      return { ok: false, error: "추천인 수신자를 찾을 수 없습니다." };
    }
  }

  const token = signReferralToken(referrerId);
  const url = `${appUrl}/r/${token}`;

  await logAudit({
    adminId: admin.id,
    action: "referral.generate_url",
    entity: "recipient",
    entityId: referrerId ?? undefined,
    metadata: { url },
  });

  return { ok: true, url };
}
