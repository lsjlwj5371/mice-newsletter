"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { rssFeedSchema } from "@/lib/validation/rss";

export type ActionResult =
  | { ok: true; id?: string; message?: string }
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
export async function createRssFeedAction(
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = rssFeedSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "입력값을 확인해 주세요.",
      fieldErrors: flattenZodError(parsed.error),
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rss_feeds")
    .insert({
      url: parsed.data.url,
      name: parsed.data.name,
      category: parsed.data.category,
      active: parsed.data.active,
      notes: parsed.data.notes,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "이미 등록된 URL입니다.",
        fieldErrors: { url: ["이미 등록된 URL입니다."] },
      };
    }
    return { ok: false, error: error.message };
  }

  await logAudit({
    adminId: admin.id,
    action: "rss_feed.create",
    entity: "rss_feed",
    entityId: data.id,
    metadata: { url: parsed.data.url, category: parsed.data.category },
  });

  revalidatePath("/rss");
  return { ok: true, id: data.id };
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────
export async function updateRssFeedAction(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = rssFeedSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "입력값을 확인해 주세요.",
      fieldErrors: flattenZodError(parsed.error),
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("rss_feeds")
    .update({
      url: parsed.data.url,
      name: parsed.data.name,
      category: parsed.data.category,
      active: parsed.data.active,
      notes: parsed.data.notes,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "이미 등록된 URL입니다.",
        fieldErrors: { url: ["이미 등록된 URL입니다."] },
      };
    }
    return { ok: false, error: error.message };
  }

  await logAudit({
    adminId: admin.id,
    action: "rss_feed.update",
    entity: "rss_feed",
    entityId: id,
  });

  revalidatePath("/rss");
  return { ok: true, id };
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────
export async function deleteRssFeedAction(
  id: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase.from("rss_feeds").delete().eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAudit({
    adminId: admin.id,
    action: "rss_feed.delete",
    entity: "rss_feed",
    entityId: id,
  });

  revalidatePath("/rss");
  return { ok: true };
}

// ─────────────────────────────────────────────
// MANUAL COLLECTION TRIGGER
// Calls the cron route internally so the same logic runs.
// ─────────────────────────────────────────────
export async function triggerCollectionAction(): Promise<ActionResult> {
  const admin = await requireAdmin();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!appUrl || !cronSecret) {
    return {
      ok: false,
      error: "NEXT_PUBLIC_APP_URL 또는 CRON_SECRET 환경변수가 설정되지 않았습니다.",
    };
  }

  try {
    const res = await fetch(`${appUrl}/api/cron/collect-articles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ manual: true, triggered_by: admin.email }),
      cache: "no-store",
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        error: body.error ?? `수집 실행 실패 (HTTP ${res.status})`,
      };
    }

    await logAudit({
      adminId: admin.id,
      action: "rss.manual_collect",
      metadata: body as Record<string, unknown>,
    });

    revalidatePath("/rss");
    revalidatePath("/articles");

    const summary = body as {
      feeds_processed?: number;
      new_articles?: number;
      analyzed?: number;
      errors?: number;
    };

    return {
      ok: true,
      message: `수집 완료 — 피드 ${summary.feeds_processed ?? 0}개 / 신규 기사 ${summary.new_articles ?? 0}건 / 분석 ${summary.analyzed ?? 0}건 / 오류 ${summary.errors ?? 0}건`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `수집 호출 중 예외: ${msg}` };
  }
}
