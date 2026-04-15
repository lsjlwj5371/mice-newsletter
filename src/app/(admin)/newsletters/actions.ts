"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { generateNewsletterDraft } from "@/lib/claude/newsletter-draft";
import { newsletterContentSchema } from "@/lib/validation/newsletter-content";
import {
  ARTICLE_CATEGORIES,
  type Article,
  type ArticleCategory,
} from "@/lib/validation/rss";
import type { NewsletterContent } from "@/types/newsletter";

export type ActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const newDraftSchema = z.object({
  issueLabel: z
    .string()
    .min(1, "호 이름은 필수입니다")
    .transform((v) => v.trim()),
  periodStart: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  periodEnd: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  referenceNotes: z
    .string()
    .optional()
    .transform((v) => v?.trim() || null),
  /** Max articles per category to feed to Claude */
  perCategoryLimit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 8)),
});

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
// CREATE DRAFT — runs Claude generation, saves new row
// ─────────────────────────────────────────────
export async function createDraftNewsletterAction(
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = newDraftSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "입력값을 확인해 주세요.",
      fieldErrors: flattenZodError(parsed.error),
    };
  }

  const supabase = createAdminClient();

  // 1. Load candidate articles by category, filtered by period
  const articlesByCategory: Record<ArticleCategory, Article[]> = {
    news: [],
    mice_in_out: [],
    tech: [],
    theory: [],
  };

  for (const cat of ARTICLE_CATEGORIES) {
    let q = supabase
      .from("articles")
      .select("*")
      .eq("category", cat)
      .order("importance", { ascending: false, nullsFirst: false })
      .order("collected_at", { ascending: false })
      .limit(parsed.data.perCategoryLimit);

    if (parsed.data.periodStart) {
      q = q.gte("collected_at", parsed.data.periodStart);
    }
    if (parsed.data.periodEnd) {
      q = q.lte("collected_at", parsed.data.periodEnd);
    }

    const { data, error } = await q;
    if (error) {
      return { ok: false, error: `기사 조회 실패 (${cat}): ${error.message}` };
    }
    articlesByCategory[cat] = (data ?? []) as Article[];
  }

  const totalArticles = Object.values(articlesByCategory).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  if (totalArticles === 0) {
    return {
      ok: false,
      error:
        "선택한 기간에 후보 기사가 하나도 없습니다. RSS 수집을 먼저 실행하거나 기간을 넓혀 주세요.",
    };
  }

  // 2. Call Claude to generate the draft
  let draftResult;
  try {
    draftResult = await generateNewsletterDraft({
      issueLabel: parsed.data.issueLabel,
      articlesByCategory,
      referenceNotes: parsed.data.referenceNotes ?? undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Claude 초안 생성 실패: ${msg}` };
  }

  // 3. Insert into DB
  const { data: inserted, error: insertErr } = await supabase
    .from("newsletters")
    .insert({
      issue_label: parsed.data.issueLabel,
      subject: draftResult.content.subject,
      status: "draft",
      schema_version: 1,
      content_json: draftResult.content,
      collection_period_start: parsed.data.periodStart,
      collection_period_end: parsed.data.periodEnd,
      reference_notes: parsed.data.referenceNotes,
      used_article_ids: draftResult.usedArticleIds,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (insertErr) {
    return { ok: false, error: `DB 저장 실패: ${insertErr.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.create_draft",
    entity: "newsletter",
    entityId: inserted.id,
    metadata: {
      issueLabel: parsed.data.issueLabel,
      articleCount: totalArticles,
    },
  });

  revalidatePath("/newsletters");
  return { ok: true, id: inserted.id };
}

// ─────────────────────────────────────────────
// UPDATE CONTENT — manual JSON edit
// ─────────────────────────────────────────────
export async function updateNewsletterContentAction(
  id: string,
  contentJsonString: string
): Promise<ActionResult> {
  const admin = await requireAdmin();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(contentJsonString);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `JSON 파싱 오류: ${msg}` };
  }

  const result = newsletterContentSchema.safeParse(parsedJson);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    return { ok: false, error: `스키마 검증 실패:\n${issues}` };
  }

  const content = result.data as NewsletterContent;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("newsletters")
    .update({
      content_json: content,
      subject: content.subject,
      status: "review",
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: `저장 실패: ${error.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.update_content",
    entity: "newsletter",
    entityId: id,
  });

  revalidatePath(`/newsletters/${id}`);
  revalidatePath("/newsletters");
  return { ok: true, id };
}

// ─────────────────────────────────────────────
// DELETE DRAFT
// ─────────────────────────────────────────────
export async function deleteNewsletterAction(
  id: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("newsletters")
    .select("issue_label, status")
    .eq("id", id)
    .single();

  if (existing?.status === "sent") {
    return {
      ok: false,
      error: "이미 발송된 호는 삭제할 수 없습니다. 보관(archived)으로 변경해 주세요.",
    };
  }

  const { error } = await supabase.from("newsletters").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.delete",
    entity: "newsletter",
    entityId: id,
    metadata: { issueLabel: existing?.issue_label ?? null },
  });

  revalidatePath("/newsletters");
  return { ok: true };
}

// ─────────────────────────────────────────────
// REGENERATE — re-run Claude with the same period/references
// ─────────────────────────────────────────────
export async function regenerateDraftAction(
  id: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("newsletters")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return { ok: false, error: "원본 호를 찾을 수 없습니다." };
  }

  if (existing.status === "sent") {
    return { ok: false, error: "이미 발송된 호는 재생성할 수 없습니다." };
  }

  // Reload articles
  const articlesByCategory: Record<ArticleCategory, Article[]> = {
    news: [],
    mice_in_out: [],
    tech: [],
    theory: [],
  };

  for (const cat of ARTICLE_CATEGORIES) {
    let q = supabase
      .from("articles")
      .select("*")
      .eq("category", cat)
      .order("importance", { ascending: false, nullsFirst: false })
      .order("collected_at", { ascending: false })
      .limit(8);

    if (existing.collection_period_start) {
      q = q.gte("collected_at", existing.collection_period_start);
    }
    if (existing.collection_period_end) {
      q = q.lte("collected_at", existing.collection_period_end);
    }
    const { data } = await q;
    articlesByCategory[cat] = (data ?? []) as Article[];
  }

  let draftResult;
  try {
    draftResult = await generateNewsletterDraft({
      issueLabel: existing.issue_label,
      articlesByCategory,
      referenceNotes: existing.reference_notes ?? undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `재생성 실패: ${msg}` };
  }

  const { error: updErr } = await supabase
    .from("newsletters")
    .update({
      content_json: draftResult.content,
      subject: draftResult.content.subject,
      used_article_ids: draftResult.usedArticleIds,
      last_drafted_at: new Date().toISOString(),
      status: "draft",
    })
    .eq("id", id);

  if (updErr) {
    return { ok: false, error: `DB 업데이트 실패: ${updErr.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.regenerate",
    entity: "newsletter",
    entityId: id,
  });

  revalidatePath(`/newsletters/${id}`);
  revalidatePath("/newsletters");
  return { ok: true, id };
}

// ─────────────────────────────────────────────
// CREATE DRAFT (wrapper that throws — used by form action with redirect)
// ─────────────────────────────────────────────
export async function createDraftAndRedirect(formData: FormData) {
  const result = await createDraftNewsletterAction(formData);
  if (!result.ok || !result.id) {
    // Form action errors are surfaced via cookies/state. For now, throw
    // so the client-side handler shows the message.
    throw new Error(result.ok ? "Unknown error" : result.error);
  }
  redirect(`/newsletters/${result.id}`);
}
