"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFormToken } from "@/lib/form-token";
import type { FormField, FormRow } from "@/lib/validation/form";

export type SubmitResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const secret = process.env.TOKEN_SECRET ?? "";
  return crypto
    .createHmac("sha256", secret)
    .update(ip)
    .digest("hex")
    .slice(0, 32);
}

function validateAnswers(
  fields: FormField[],
  rawAnswers: Record<string, unknown>
): { ok: true; answers: Record<string, string | string[]> } | { ok: false; error: string } {
  const out: Record<string, string | string[]> = {};
  for (const f of fields) {
    const raw = rawAnswers[f.id];
    if (f.required && (raw === undefined || raw === null || raw === "")) {
      return { ok: false, error: `필수 입력: ${f.label}` };
    }
    if (raw === undefined || raw === null) continue;

    if (f.type === "email") {
      const s = String(raw).trim();
      if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
        return { ok: false, error: `이메일 형식 오류: ${f.label}` };
      }
      if (s) out[f.id] = s;
    } else if (f.type === "text" || f.type === "textarea") {
      const s = String(raw).trim();
      if (s) out[f.id] = s.slice(0, 5000);
    } else if (f.type === "choice") {
      if (Array.isArray(raw)) {
        const cleaned = raw
          .filter((v) => typeof v === "string")
          .map((v) => String(v));
        if (cleaned.length > 0) out[f.id] = cleaned;
      } else {
        const s = String(raw).trim();
        if (s) out[f.id] = s;
      }
    }
  }
  return { ok: true, answers: out };
}

export async function submitFormAction(input: {
  token: string;
  answers: Record<string, unknown>;
  /** Optional: if the reader wants us to tie the response to their email. */
  email?: string;
  name?: string;
}): Promise<SubmitResult> {
  const claims = verifyFormToken(input.token);
  if (!claims) {
    return { ok: false, error: "링크가 유효하지 않습니다." };
  }

  const supabase = createAdminClient();
  const { data: formRow, error } = await supabase
    .from("forms")
    .select("*")
    .eq("id", claims.formId)
    .single();
  if (error || !formRow) {
    return { ok: false, error: "폼을 찾을 수 없습니다." };
  }
  const form = formRow as FormRow;
  if (!form.is_open) {
    return { ok: false, error: "이 폼은 더 이상 응답을 받지 않습니다." };
  }

  const validation = validateAnswers(form.fields, input.answers);
  if (!validation.ok) return validation;

  // Try to link the response to an existing recipient if email provided
  let recipientId: string | null = null;
  const email = input.email?.trim();
  if (email) {
    const { data: rec } = await supabase
      .from("recipients")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    recipientId = rec?.id ?? null;
  }

  const h = await headers();
  const userAgent = h.get("user-agent") ?? null;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;

  const { error: insertErr } = await supabase.from("form_responses").insert({
    form_id: form.id,
    answers: validation.answers,
    recipient_id: recipientId,
    recipient_email: email ?? null,
    recipient_name: input.name?.trim() || null,
    user_agent: userAgent,
    ip_hash: hashIp(ip),
  });

  if (insertErr) {
    return { ok: false, error: `저장 실패: ${insertErr.message}` };
  }

  return {
    ok: true,
    message: form.success_message ?? "응답 주셔서 감사합니다!",
  };
}
