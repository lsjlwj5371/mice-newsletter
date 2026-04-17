"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { formSchema, type FormField } from "@/lib/validation/form";
import { signFormToken } from "@/lib/form-token";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

function ensureFieldIds(fields: FormField[]): FormField[] {
  return fields.map((f) =>
    f.id ? f : { ...f, id: crypto.randomBytes(4).toString("hex") }
  );
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────
export async function createFormAction(
  input: unknown
): Promise<ActionResult<{ id: string; url: string }>> {
  const admin = await requireAdmin();
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const supabase = createAdminClient();
  const fields = ensureFieldIds(parsed.data.fields);

  const { data, error } = await supabase
    .from("forms")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      kind: parsed.data.kind,
      fields,
      newsletter_id: parsed.data.newsletterId ?? null,
      success_message: parsed.data.successMessage ?? null,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: `생성 실패: ${error.message}` };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const token = signFormToken(data.id);
  const url = `${appUrl}/f/${token}`;

  await logAudit({
    adminId: admin.id,
    action: "form.create",
    entity: "form",
    entityId: data.id,
    metadata: { title: parsed.data.title, kind: parsed.data.kind },
  });

  revalidatePath("/events");

  return { ok: true, data: { id: data.id, url } };
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────
export async function updateFormAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const supabase = createAdminClient();
  const fields = ensureFieldIds(parsed.data.fields);

  const { error } = await supabase
    .from("forms")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      kind: parsed.data.kind,
      fields,
      newsletter_id: parsed.data.newsletterId ?? null,
      success_message: parsed.data.successMessage ?? null,
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: `저장 실패: ${error.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "form.update",
    entity: "form",
    entityId: id,
  });

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// TOGGLE OPEN / CLOSE
// ─────────────────────────────────────────────
export async function setFormOpenAction(
  id: string,
  open: boolean
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const update: Record<string, unknown> = { is_open: open };
  if (!open) update.closed_at = new Date().toISOString();
  else update.closed_at = null;

  const { error } = await supabase.from("forms").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminId: admin.id,
    action: open ? "form.open" : "form.close",
    entity: "form",
    entityId: id,
  });

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// DELETE (cascade removes responses)
// ─────────────────────────────────────────────
export async function deleteFormAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase.from("forms").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminId: admin.id,
    action: "form.delete",
    entity: "form",
    entityId: id,
  });

  revalidatePath("/events");
  return { ok: true };
}

// ─────────────────────────────────────────────
// GET PUBLIC URL for a form
// ─────────────────────────────────────────────
export async function getFormShareUrlAction(
  id: string
): Promise<ActionResult<{ url: string }>> {
  await requireAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const token = signFormToken(id);
  return { ok: true, data: { url: `${appUrl}/f/${token}` } };
}
