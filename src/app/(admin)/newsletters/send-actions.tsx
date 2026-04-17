"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { processSendQueue } from "@/lib/send-queue";
import type { ActionResult } from "./actions";

/**
 * Generate a random token placeholder for the sends.token column.
 * The real HMAC-signed unsubscribe token used in URLs is derived at
 * send time via signToken() — this is just a unique row identifier
 * that satisfies the NOT NULL unique constraint.
 */
function makeQueueToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

// ─────────────────────────────────────────────
// TEST SEND — send to one or more ad-hoc emails
// ─────────────────────────────────────────────

const testSendSchema = z.object({
  newsletterId: z.string().uuid(),
  emails: z
    .string()
    .transform((v) =>
      v
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter(Boolean)
    )
    .pipe(
      z.array(z.string().email("이메일 형식이 올바르지 않습니다")).min(1, "1개 이상 입력")
    ),
});

export interface SendTestInput {
  newsletterId: string;
  emails: string; // comma- or newline-separated
}

export async function sendTestEmailAction(
  input: SendTestInput
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = testSendSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const supabase = createAdminClient();

  // Verify newsletter exists and is editable
  const { data: nl, error: nlErr } = await supabase
    .from("newsletters")
    .select("id, issue_label")
    .eq("id", parsed.data.newsletterId)
    .single();
  if (nlErr || !nl) {
    return { ok: false, error: "뉴스레터를 찾을 수 없습니다." };
  }

  // Enqueue a test send per email
  const rows = parsed.data.emails.map((email) => ({
    newsletter_id: parsed.data.newsletterId,
    recipient_email: email,
    recipient_name: null,
    recipient_id: null,
    status: "queued" as const,
    is_test: true,
    token: makeQueueToken(),
    triggered_by: admin.id,
  }));

  const { error: insertErr } = await supabase.from("sends").insert(rows);
  if (insertErr) {
    return { ok: false, error: `큐 등록 실패: ${insertErr.message}` };
  }

  // Drain immediately (test sends are usually 1~5 emails, fits in one invocation)
  const deadline = Date.now() + 55_000;
  const result = await processSendQueue({
    supabase,
    newsletterId: parsed.data.newsletterId,
    deadlineMs: deadline,
  });

  await logAudit({
    adminId: admin.id,
    action: "newsletter.test_send",
    entity: "newsletter",
    entityId: parsed.data.newsletterId,
    metadata: { emails: parsed.data.emails, result },
  });

  revalidatePath(`/newsletters/${parsed.data.newsletterId}`);

  if (result.sent === 0 && result.failed > 0) {
    return {
      ok: false,
      error: `${result.failed}건 발송 실패. 발송 이력에서 상세 확인.`,
    };
  }
  return {
    ok: true,
    message: `테스트 발송 완료: ${result.sent}건 성공${
      result.failed > 0 ? ` · ${result.failed}건 실패` : ""
    }${
      result.hitDeadline ? " (일부는 백그라운드에서 계속 발송)" : ""
    }`,
  };
}

// ─────────────────────────────────────────────
// MASS SEND — enqueue all active recipients
// ─────────────────────────────────────────────

export async function sendNewsletterAction(
  newsletterId: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Verify newsletter and ensure it's not already sent
  const { data: nl, error: nlErr } = await supabase
    .from("newsletters")
    .select("id, issue_label, status")
    .eq("id", newsletterId)
    .single();
  if (nlErr || !nl) {
    return { ok: false, error: "뉴스레터를 찾을 수 없습니다." };
  }
  if (nl.status === "sent") {
    return { ok: false, error: "이미 발송된 호입니다. 다시 보내기는 Phase 5.2에서 지원됩니다." };
  }

  // Fetch all active recipients
  const { data: recipients, error: recErr } = await supabase
    .from("recipients")
    .select("id, email, name")
    .eq("status", "active");
  if (recErr) {
    return { ok: false, error: `수신자 조회 실패: ${recErr.message}` };
  }
  if (!recipients || recipients.length === 0) {
    return { ok: false, error: "활성 상태인 수신자가 없습니다." };
  }

  // Enqueue
  const rows = recipients.map((r) => ({
    newsletter_id: newsletterId,
    recipient_id: r.id,
    recipient_email: r.email,
    recipient_name: r.name,
    status: "queued" as const,
    is_test: false,
    token: makeQueueToken(),
    triggered_by: admin.id,
  }));

  // Insert in chunks of 500 to stay under REST body limits
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("sends").insert(chunk);
    if (error) {
      return { ok: false, error: `큐 등록 실패: ${error.message}` };
    }
  }

  // Mark newsletter as scheduled (sent_at gets stamped once queue drains,
  // but we optimistically move it out of draft state)
  await supabase
    .from("newsletters")
    .update({ status: "scheduled" })
    .eq("id", newsletterId);

  // Drain as much as we can synchronously so small lists complete in one click
  const deadline = Date.now() + 55_000;
  const drainResult = await processSendQueue({
    supabase,
    newsletterId,
    deadlineMs: deadline,
  });

  // If the whole queue for this newsletter is drained, mark as sent
  const { count: remaining } = await supabase
    .from("sends")
    .select("*", { count: "exact", head: true })
    .eq("newsletter_id", newsletterId)
    .in("status", ["queued", "sending"]);

  if (!remaining || remaining === 0) {
    await supabase
      .from("newsletters")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", newsletterId);
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.mass_send",
    entity: "newsletter",
    entityId: newsletterId,
    metadata: {
      recipient_count: rows.length,
      drained: drainResult,
      remaining: remaining ?? 0,
    },
  });

  revalidatePath(`/newsletters/${newsletterId}`);
  revalidatePath("/newsletters");

  return {
    ok: true,
    message:
      `큐에 ${rows.length}건 등록. ` +
      `즉시 ${drainResult.sent}건 발송 완료` +
      (drainResult.failed > 0 ? ` · ${drainResult.failed}건 실패` : "") +
      (remaining && remaining > 0
        ? ` · 나머지 ${remaining}건은 1분마다 자동 발송됩니다.`
        : ""),
  };
}

// ─────────────────────────────────────────────
// RESEND — re-dispatch a newsletter to a chosen audience
// ─────────────────────────────────────────────

export type ResendAudience =
  | "specific"    // use `emails` list
  | "non_openers" // active recipients whose sends.opened_at is null
  | "failed";     // recipients whose last send for this newsletter failed

export interface ResendInput {
  newsletterId: string;
  audience: ResendAudience;
  /** Required when audience='specific'; comma/newline separated list. */
  emails?: string;
}

export async function resendNewsletterAction(
  input: ResendInput
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: nl, error: nlErr } = await supabase
    .from("newsletters")
    .select("id, issue_label, status")
    .eq("id", input.newsletterId)
    .single();
  if (nlErr || !nl) {
    return { ok: false, error: "뉴스레터를 찾을 수 없습니다." };
  }

  // Build the target recipient list
  let targets: Array<{
    email: string;
    name: string | null;
    recipient_id: string | null;
  }> = [];

  if (input.audience === "specific") {
    const parsed = (input.emails ?? "")
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length === 0) {
      return { ok: false, error: "대상 이메일을 입력해 주세요." };
    }
    // Try to attach recipient_id by looking them up
    const { data: recs } = await supabase
      .from("recipients")
      .select("id, email, name")
      .in("email", parsed);
    const byEmail = new Map(
      (recs ?? []).map((r) => [r.email.toLowerCase(), r])
    );
    targets = parsed.map((email) => {
      const r = byEmail.get(email.toLowerCase());
      return {
        email,
        name: r?.name ?? null,
        recipient_id: r?.id ?? null,
      };
    });
  } else if (input.audience === "non_openers") {
    // Active recipients with at least one non-test send for this
    // newsletter whose opened_at is null.
    const { data: rows, error: rowsErr } = await supabase
      .from("sends")
      .select(
        "recipient_id, recipient_email, recipient_name, opened_at, is_test, status"
      )
      .eq("newsletter_id", input.newsletterId)
      .eq("is_test", false);
    if (rowsErr) {
      return { ok: false, error: `발송 이력 조회 실패: ${rowsErr.message}` };
    }
    const nonOpeners = (rows ?? []).filter(
      (r) => r.status === "sent" && !r.opened_at
    );
    const seen = new Set<string>();
    for (const r of nonOpeners) {
      const key = r.recipient_email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({
        email: r.recipient_email,
        name: r.recipient_name,
        recipient_id: r.recipient_id,
      });
    }
  } else if (input.audience === "failed") {
    const { data: rows, error: rowsErr } = await supabase
      .from("sends")
      .select("recipient_id, recipient_email, recipient_name, status, is_test")
      .eq("newsletter_id", input.newsletterId)
      .eq("is_test", false)
      .eq("status", "failed");
    if (rowsErr) {
      return { ok: false, error: `실패 이력 조회 실패: ${rowsErr.message}` };
    }
    const seen = new Set<string>();
    for (const r of rows ?? []) {
      const key = r.recipient_email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({
        email: r.recipient_email,
        name: r.recipient_name,
        recipient_id: r.recipient_id,
      });
    }
  }

  if (targets.length === 0) {
    return { ok: false, error: "대상 수신자가 없습니다." };
  }

  // If audience requires active status, filter out unsubscribed recipients
  if (input.audience !== "specific") {
    const recipientIds = targets
      .map((t) => t.recipient_id)
      .filter((id): id is string => !!id);
    if (recipientIds.length > 0) {
      const { data: activeRows } = await supabase
        .from("recipients")
        .select("id, status")
        .in("id", recipientIds);
      const activeSet = new Set(
        (activeRows ?? [])
          .filter((r) => r.status === "active")
          .map((r) => r.id)
      );
      targets = targets.filter(
        (t) => !t.recipient_id || activeSet.has(t.recipient_id)
      );
    }
  }

  // Enqueue
  const rows = targets.map((t) => ({
    newsletter_id: input.newsletterId,
    recipient_id: t.recipient_id,
    recipient_email: t.email,
    recipient_name: t.name,
    status: "queued" as const,
    is_test: false,
    token: makeQueueToken(),
    triggered_by: admin.id,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("sends").insert(chunk);
    if (error) {
      return { ok: false, error: `큐 등록 실패: ${error.message}` };
    }
  }

  // Drain synchronously up to the deadline
  const drain = await processSendQueue({
    supabase,
    newsletterId: input.newsletterId,
    deadlineMs: Date.now() + 55_000,
  });

  await logAudit({
    adminId: admin.id,
    action: "newsletter.resend",
    entity: "newsletter",
    entityId: input.newsletterId,
    metadata: {
      audience: input.audience,
      count: rows.length,
      drained: drain,
    },
  });

  revalidatePath(`/newsletters/${input.newsletterId}`);
  revalidatePath("/history");

  return {
    ok: true,
    message:
      `${rows.length}건 재발송 큐 등록. ` +
      `즉시 ${drain.sent}건 발송 완료` +
      (drain.failed > 0 ? ` · ${drain.failed}건 실패` : ""),
  };
}
