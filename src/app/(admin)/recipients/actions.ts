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
// BULK CREATE
// Accepts an array of parsed recipient rows and inserts them in one
// round-trip. Duplicate emails (on the unique index) are silently
// skipped via `ignoreDuplicates: true`. Returns a summary so the UI
// can report "N명 추가, M명 중복 스킵".
// ─────────────────────────────────────────────
export interface BulkRecipientRow {
  email: string;
  name?: string | null;
  organization?: string | null;
  position?: string | null;
  job_function?: string | null;
  tags?: string[];
  notes?: string | null;
}

export type BulkActionResult =
  | {
      ok: true;
      inserted: number;
      skippedDuplicate: number;
      invalidRows: Array<{ line: number; value: string; error: string }>;
    }
  | { ok: false; error: string };

export async function bulkCreateRecipientsAction(
  rows: BulkRecipientRow[]
): Promise<BulkActionResult> {
  const admin = await requireAdmin();

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "추가할 수신자가 없습니다." };
  }
  if (rows.length > 2000) {
    return {
      ok: false,
      error: "한 번에 최대 2,000명까지 추가할 수 있습니다. 나눠서 시도해 주세요.",
    };
  }

  // Revalidate each row through the same schema the single-add path
  // uses. Anything that fails validation is reported back per-row so
  // the admin can fix the source list.
  const invalidRows: Array<{ line: number; value: string; error: string }> = [];
  const validPayload: Array<Record<string, unknown>> = [];
  const seenEmails = new Set<string>();

  rows.forEach((row, i) => {
    const parsed = recipientSchema.safeParse({
      email: row.email,
      name: row.name ?? undefined,
      organization: row.organization ?? undefined,
      position: row.position ?? undefined,
      job_function: row.job_function ?? undefined,
      status: "active",
      source: "manual",
      tags: row.tags?.join(", "),
      notes: row.notes ?? undefined,
    });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      invalidRows.push({
        line: i + 1,
        value: row.email ?? "",
        error: firstIssue?.message ?? "유효하지 않은 행",
      });
      return;
    }
    // Dedup within the submitted batch itself — upsert onConflict only
    // handles conflicts with existing DB rows, not intra-batch dupes.
    if (seenEmails.has(parsed.data.email)) return;
    seenEmails.add(parsed.data.email);

    validPayload.push({
      email: parsed.data.email,
      name: parsed.data.name,
      organization: parsed.data.organization,
      position: parsed.data.position,
      job_function: parsed.data.job_function,
      status: parsed.data.status,
      source: parsed.data.source,
      tags: parsed.data.tags,
      notes: parsed.data.notes,
    });
  });

  if (validPayload.length === 0) {
    return { ok: true, inserted: 0, skippedDuplicate: 0, invalidRows };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("recipients")
    .upsert(validPayload, {
      onConflict: "email",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }

  const inserted = data?.length ?? 0;
  const skippedDuplicate = validPayload.length - inserted;

  await logAudit({
    adminId: admin.id,
    action: "recipient.bulk_create",
    entity: "recipient",
    metadata: {
      submitted: rows.length,
      inserted,
      skippedDuplicate,
      invalid: invalidRows.length,
    },
  });

  revalidatePath("/recipients");
  return { ok: true, inserted, skippedDuplicate, invalidRows };
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
