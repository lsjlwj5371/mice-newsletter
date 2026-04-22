"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { unmarkArticlesUsedForNewsletter } from "@/lib/article-used";
import {
  generateNewsletterDraft,
  regenerateSingleBlock,
  getArticlesForBlock,
  BLOCK_RELEVANT_CATEGORIES,
  BLOCK_ARTICLE_POLICY,
} from "@/lib/claude/newsletter-draft";
import { newsletterContentSchema } from "@/lib/validation/newsletter-content";
import {
  ARTICLE_CATEGORIES,
  type Article,
  type ArticleCategory,
} from "@/lib/validation/rss";
import {
  BLOCK_TYPES,
  IMAGE_LAYOUTS,
  type BlockType,
  type NewsletterContent,
  type ImageLayout,
} from "@/types/newsletter";

export type ActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * When regenerating a single block, Claude returns fresh content but has
 * no idea about the admin's prior manual edits (uploaded images, layout
 * choices, visibility toggles for compound blocks). Copy those fields
 * over from the OLD data onto the NEW data so they survive the swap.
 *
 * Everything else — text content, paragraph arrays, chapter lists — is
 * replaced, because that's what the admin asked Claude to redo.
 */
function mergePreservedBlockFields(
  type: BlockType,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...newData };

  // Every image-bearing block has a top-level imageUrl / imageLayout.
  if (oldData.imageUrl !== undefined && merged.imageUrl === undefined) {
    merged.imageUrl = oldData.imageUrl;
  }
  if (oldData.imageLayout !== undefined && merged.imageLayout === undefined) {
    merged.imageLayout = oldData.imageLayout;
  }

  if (type === "groundk_story") {
    // Preserve per-part image + layout + the admin's show/hide choices
    // for Field Briefing and Project Sketch.
    const oldFB = (oldData.fieldBriefing as Record<string, unknown>) ?? {};
    const newFB = (merged.fieldBriefing as Record<string, unknown>) ?? {};
    merged.fieldBriefing = {
      ...newFB,
      imageUrl: newFB.imageUrl ?? oldFB.imageUrl,
      imageLayout: newFB.imageLayout ?? oldFB.imageLayout,
    };

    const oldPS = (oldData.projectSketch as Record<string, unknown>) ?? {};
    const newPS = (merged.projectSketch as Record<string, unknown>) ?? {};
    merged.projectSketch = {
      ...newPS,
      imageUrl: newPS.imageUrl ?? oldPS.imageUrl,
      imageLayout: newPS.imageLayout ?? oldPS.imageLayout,
    };

    if (oldData.showFieldBriefing !== undefined) {
      merged.showFieldBriefing = oldData.showFieldBriefing;
    }
    if (oldData.showProjectSketch !== undefined) {
      merged.showProjectSketch = oldData.showProjectSketch;
    }
  }

  return merged;
}

/** Build an empty { [category]: [] } map that covers every current article
 *  category — derived from ARTICLE_CATEGORIES so new block types get keys
 *  automatically. */
function emptyArticlesByCategory(): Record<ArticleCategory, Article[]> {
  const out: Partial<Record<ArticleCategory, Article[]>> = {};
  for (const c of ARTICLE_CATEGORIES) out[c] = [];
  return out as Record<ArticleCategory, Article[]>;
}

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
  const articlesByCategory: Record<ArticleCategory, Article[]> =
    emptyArticlesByCategory();

  for (const cat of ARTICLE_CATEGORIES) {
    let q = supabase
      .from("articles")
      .select("*")
      .contains("categories", [cat])
      .order("importance", { ascending: false, nullsFirst: false })
      .order("collected_at", { ascending: false })
      .limit(parsed.data.perCategoryLimit);

    if (parsed.data.periodStart) {
      q = q.gte("collected_at", parsed.data.periodStart);
    }
    if (parsed.data.periodEnd) {
      // periodEnd is YYYY-MM-DD. Postgres parses bare dates as 00:00:00 UTC,
      // which would exclude articles collected later in the day. Bump to the
      // next day's 00:00:00 with an exclusive upper bound so the entire end
      // day is included.
      const endDate = new Date(parsed.data.periodEnd);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      q = q.lt("collected_at", endDate.toISOString());
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
// UPDATE SUBJECT — quick edit of the email subject line alone
// ─────────────────────────────────────────────
export async function updateNewsletterSubjectAction(
  id: string,
  nextSubject: string
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const trimmed = nextSubject.trim();
  if (!trimmed) {
    return { ok: false, error: "제목은 비워둘 수 없습니다." };
  }
  if (trimmed.length > 200) {
    return { ok: false, error: "제목이 너무 깁니다 (최대 200자)." };
  }

  const supabase = createAdminClient();
  const { data: row, error: fetchErr } = await supabase
    .from("newsletters")
    .select("id, status, content_json")
    .eq("id", id)
    .single();
  if (fetchErr || !row) {
    return { ok: false, error: "원본 호를 찾을 수 없습니다." };
  }
  if (row.status === "sent") {
    return { ok: false, error: "이미 발송된 호는 수정할 수 없습니다." };
  }

  const content = row.content_json as NewsletterContent;
  const updatedContent = { ...content, subject: trimmed };

  const { error: updErr } = await supabase
    .from("newsletters")
    .update({
      content_json: updatedContent,
      subject: trimmed,
    })
    .eq("id", id);
  if (updErr) {
    return { ok: false, error: `저장 실패: ${updErr.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.update_subject",
    entity: "newsletter",
    entityId: id,
    metadata: { subject: trimmed },
  });

  revalidatePath(`/newsletters/${id}`);
  revalidatePath("/newsletters");
  return { ok: true, id, message: "제목이 저장되었습니다." };
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

  // Return any articles this draft had claimed back to the candidate pool.
  // (New flow only sets used_in_newsletter_id at send time, but this handles
  // legacy rows from before that change as well.)
  await unmarkArticlesUsedForNewsletter(supabase, id);

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
  const articlesByCategory: Record<ArticleCategory, Article[]> =
    emptyArticlesByCategory();

  for (const cat of ARTICLE_CATEGORIES) {
    let q = supabase
      .from("articles")
      .select("*")
      .contains("categories", [cat])
      .order("importance", { ascending: false, nullsFirst: false })
      .order("collected_at", { ascending: false })
      .limit(8);

    if (existing.collection_period_start) {
      q = q.gte("collected_at", existing.collection_period_start);
    }
    if (existing.collection_period_end) {
      // Same fix as createDraftNewsletterAction: include the entire end day
      const endDate = new Date(existing.collection_period_end);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      q = q.lt("collected_at", endDate.toISOString());
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

// ─────────────────────────────────────────────
// CREATE DRAFT WITH BLOCK CONFIGURATION (Phase 4.3-B)
// Accepts typed block picker payload from the new-draft-form and passes
// per-block instructions + autoSearch flags to Claude.
// ─────────────────────────────────────────────

export interface BlockConfigInput {
  type: BlockType;
  instructions: string | null;
  autoSearch: boolean;
  /** Admin-picked article IDs for this block. When set, bypass the
   *  category/date partition and pass these exact articles to Claude. */
  forcedArticleIds?: string[];
  /** groundk_story only — per-part visibility. Default true. */
  showFieldBriefing?: boolean;
  showProjectSketch?: boolean;
}

export interface CreateDraftWithBlocksInput {
  issueLabel: string;
  /** Numeric volume number shown as "VOL 001" in the header. When
   *  undefined the header falls back to the legacy issueMeta string. */
  issueNumber?: number;
  /** Intended send date shown next to the "ISSUE" label. ISO date. */
  issueDate?: string;
  periodStart: string | null;
  periodEnd: string | null;
  perCategoryLimit: number;
  referenceNotes: string | null;
  blocks: BlockConfigInput[];
}

export async function createDraftWithBlocksAction(
  input: CreateDraftWithBlocksInput
): Promise<ActionResult> {
  const admin = await requireAdmin();

  // Validation
  const issueLabel = input.issueLabel.trim();
  if (!issueLabel) {
    return { ok: false, error: "호 이름은 필수입니다." };
  }
  if (!input.blocks || input.blocks.length === 0) {
    return { ok: false, error: "최소 하나 이상의 블록이 필요합니다." };
  }
  for (const b of input.blocks) {
    if (!(BLOCK_TYPES as readonly string[]).includes(b.type)) {
      return { ok: false, error: `알 수 없는 블록 타입: ${b.type}` };
    }
  }

  const perCategoryLimit = Math.max(
    3,
    Math.min(20, input.perCategoryLimit || 8)
  );

  const supabase = createAdminClient();

  // Load candidate articles — both date-filtered (for most blocks) and
  // all-time (for blocks like theory_to_field that read academic/research
  // material regardless of when it was collected).
  const needsResearch = input.blocks.some((b) => b.autoSearch);
  const needsAllTime = input.blocks.some(
    (b) => b.autoSearch && BLOCK_ARTICLE_POLICY[b.type].ignoreDateFilter
  );

  const articlesByCategory: Record<ArticleCategory, Article[]> =
    emptyArticlesByCategory();
  const articlesByCategoryAllTime: Record<ArticleCategory, Article[]> =
    emptyArticlesByCategory();

  // Loading rules:
  //  - exclude articles with review_status='archived' (admin said "not needed")
  //  - sort pinned articles first (admin said "use next issue"), then by
  //    importance desc, then by collected_at desc
  //  - widen per-category limit: partitioning will distribute across blocks
  //    so a single block won't see all N, but total pool needs to be deep
  const effectiveLimit = Math.max(perCategoryLimit, 15);

  if (needsResearch) {
    for (const cat of ARTICLE_CATEGORIES) {
      let q = supabase
        .from("articles")
        .select("*")
        .contains("categories", [cat])
        .eq("review_status", "new")
        .order("pinned", { ascending: false })
        .order("importance", { ascending: false, nullsFirst: false })
        .order("collected_at", { ascending: false })
        .limit(effectiveLimit);

      if (input.periodStart) {
        q = q.gte("collected_at", input.periodStart);
      }
      if (input.periodEnd) {
        const endDate = new Date(input.periodEnd);
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        q = q.lt("collected_at", endDate.toISOString());
      }

      const { data, error } = await q;
      if (error) {
        return { ok: false, error: `기사 조회 실패 (${cat}): ${error.message}` };
      }
      articlesByCategory[cat] = (data ?? []) as Article[];
    }
  }

  if (needsAllTime) {
    for (const cat of ARTICLE_CATEGORIES) {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .contains("categories", [cat])
        .eq("review_status", "new")
        .order("pinned", { ascending: false })
        .order("importance", { ascending: false, nullsFirst: false })
        .order("collected_at", { ascending: false })
        .limit(40);

      if (error) {
        return {
          ok: false,
          error: `전체기간 기사 조회 실패 (${cat}): ${error.message}`,
        };
      }
      articlesByCategoryAllTime[cat] = (data ?? []) as Article[];
    }
  }

  // Resolve any admin-forced article picks into full Article rows so
  // generateNewsletterDraft can pass them through to Claude. Collected
  // once up-front across all blocks to keep it to a single query.
  const allForcedIds = Array.from(
    new Set(
      input.blocks.flatMap((b) => b.forcedArticleIds ?? []).filter(Boolean)
    )
  );
  const forcedById = new Map<string, Article>();
  if (allForcedIds.length > 0) {
    const { data: forcedRows, error: forcedErr } = await supabase
      .from("articles")
      .select("*")
      .in("id", allForcedIds);
    if (forcedErr) {
      return {
        ok: false,
        error: `지정 기사 조회 실패: ${forcedErr.message}`,
      };
    }
    for (const a of forcedRows ?? []) {
      forcedById.set(a.id as string, a as Article);
    }
  }

  // Call Claude
  let draftResult;
  try {
    draftResult = await generateNewsletterDraft({
      issueLabel,
      issueNumber: input.issueNumber,
      issueDate: input.issueDate,
      articlesByCategory,
      articlesByCategoryAllTime: needsAllTime
        ? articlesByCategoryAllTime
        : undefined,
      referenceNotes: input.referenceNotes ?? undefined,
      blockTypes: input.blocks.map((b) => b.type),
      blockInstructions: input.blocks.map((b) => {
        const forcedIds = (b.forcedArticleIds ?? []).filter(Boolean);
        const forcedArticles = forcedIds
          .map((id) => forcedById.get(id))
          .filter((a): a is Article => !!a);
        return {
          type: b.type,
          instructions: b.instructions ?? undefined,
          autoSearch: b.autoSearch,
          forcedArticleIds: forcedIds.length > 0 ? forcedIds : undefined,
          forcedArticles: forcedArticles.length > 0 ? forcedArticles : undefined,
        };
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Claude 초안 생성 실패: ${msg}` };
  }

  // Stamp any per-block visibility flags that don't round-trip through
  // Claude (e.g. groundk_story show toggles) onto the generated blocks.
  // This runs AFTER generation so Claude's freshly produced data gets
  // the admin's structural choices layered on top.
  draftResult.content.blocks = draftResult.content.blocks.map((blk, idx) => {
    const cfg = input.blocks[idx];
    if (!cfg || cfg.type !== "groundk_story") return blk;
    return {
      ...blk,
      data: {
        ...(blk.data as Record<string, unknown>),
        showFieldBriefing: cfg.showFieldBriefing ?? true,
        showProjectSketch: cfg.showProjectSketch ?? true,
      },
    } as typeof blk;
  });

  // Save
  const { data: inserted, error: insertErr } = await supabase
    .from("newsletters")
    .insert({
      issue_label: issueLabel,
      subject: draftResult.content.subject,
      status: "draft",
      schema_version: 2,
      content_json: draftResult.content,
      collection_period_start: input.periodStart,
      collection_period_end: input.periodEnd,
      reference_notes: input.referenceNotes,
      used_article_ids: draftResult.usedArticleIds,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (insertErr) {
    return { ok: false, error: `DB 저장 실패: ${insertErr.message}` };
  }

  // Pinned flag is a "please include this in the next draft" request —
  // its purpose is fulfilled the moment the article lands in a draft,
  // so clear it now. `used_in_newsletter_id` is NOT set here: that
  // backlink is reserved for articles that made it into an actually-sent
  // newsletter (see lib/article-used.ts). If this draft is discarded,
  // the pin stays cleared (admin can re-pin) but no article ends up
  // incorrectly marked as "used".
  const referencedByAnyBlock = Array.from(
    new Set(
      (draftResult.content.blocks ?? []).flatMap(
        (b) => b.referencedArticleIds ?? []
      )
    )
  );
  if (referencedByAnyBlock.length > 0) {
    await supabase
      .from("articles")
      .update({ pinned: false })
      .in("id", referencedByAnyBlock);
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.create_draft",
    entity: "newsletter",
    entityId: inserted.id,
    metadata: {
      issueLabel,
      blockCount: input.blocks.length,
      blockTypes: input.blocks.map((b) => b.type),
      failedBlocks: draftResult.failedBlocks,
      referencedArticles: referencedByAnyBlock.length,
    },
  });

  revalidatePath("/newsletters");
  revalidatePath("/articles");
  const failedSummary = draftResult.failedBlocks.length > 0
    ? ` (경고: ${draftResult.failedBlocks.length}개 블록 생성 실패 — placeholder로 대체됨)`
    : "";
  return { ok: true, id: inserted.id, message: `초안 생성 완료${failedSummary}` };
}

// ─────────────────────────────────────────────
// SET / CLEAR IMAGE on a specific block
// Updates content_json.blocks[i].data.imageUrl. For groundk_story it
// can target either fieldBriefing or projectSketch via `slot`.
// ─────────────────────────────────────────────

export interface SetBlockImageInput {
  newsletterId: string;
  blockIndex: number;
  imageUrl: string | null;
  /** For compound blocks like groundk_story: which sub-part to target. */
  slot?: "fieldBriefing" | "projectSketch";
  /** For array-based blocks (news_briefing.items, event_radar.events):
   *  which item to patch. Mutually exclusive with `slot`. */
  itemIndex?: number;
}

export async function setBlockImageAction(
  input: SetBlockImageInput
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: row, error: fetchErr } = await supabase
    .from("newsletters")
    .select("*")
    .eq("id", input.newsletterId)
    .single();
  if (fetchErr || !row) {
    return { ok: false, error: "원본 호를 찾을 수 없습니다." };
  }
  if (row.status === "sent") {
    return { ok: false, error: "이미 발송된 호는 수정할 수 없습니다." };
  }

  const content = row.content_json as NewsletterContent;
  if (
    !content.blocks ||
    input.blockIndex < 0 ||
    input.blockIndex >= content.blocks.length
  ) {
    return { ok: false, error: "해당 블록을 찾을 수 없습니다." };
  }

  const block = content.blocks[input.blockIndex];
  const nextValue = input.imageUrl ?? undefined;

  // Build the updated block depending on its type.
  let updatedBlock = block as NewsletterContent["blocks"][number];
  const data = block.data as Record<string, unknown>;

  if (block.type === "groundk_story" && input.slot) {
    const sub = (data[input.slot] ?? {}) as Record<string, unknown>;
    updatedBlock = {
      ...block,
      data: {
        ...data,
        [input.slot]: { ...sub, imageUrl: nextValue },
      },
    } as NewsletterContent["blocks"][number];
  } else if (input.itemIndex !== undefined) {
    // Array-based blocks: patch the nested item's imageUrl rather than
    // the block's top-level data.imageUrl. Only news_briefing and
    // event_radar have item arrays with imageUrl.
    const nestedKey =
      block.type === "news_briefing"
        ? "items"
        : block.type === "event_radar"
        ? "events"
        : null;
    if (!nestedKey) {
      return {
        ok: false,
        error: `${block.type} 블록은 항목별 이미지를 지원하지 않습니다.`,
      };
    }
    const nested = (data[nestedKey] as Array<Record<string, unknown>>) ?? [];
    if (input.itemIndex < 0 || input.itemIndex >= nested.length) {
      return { ok: false, error: "해당 항목을 찾을 수 없습니다." };
    }
    const nextNested = [...nested];
    const target = { ...nextNested[input.itemIndex] };
    if (nextValue) target.imageUrl = nextValue;
    else delete target.imageUrl;
    nextNested[input.itemIndex] = target;
    updatedBlock = {
      ...block,
      data: { ...data, [nestedKey]: nextNested },
    } as NewsletterContent["blocks"][number];
  } else {
    updatedBlock = {
      ...block,
      data: { ...data, imageUrl: nextValue },
    } as NewsletterContent["blocks"][number];
  }

  const updatedBlocks = [...content.blocks];
  updatedBlocks[input.blockIndex] = updatedBlock;
  const updatedContent: NewsletterContent = {
    ...content,
    blocks: updatedBlocks,
  };

  const { error: updErr } = await supabase
    .from("newsletters")
    .update({ content_json: updatedContent })
    .eq("id", input.newsletterId);
  if (updErr) {
    return { ok: false, error: `DB 저장 실패: ${updErr.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: input.imageUrl ? "newsletter.set_image" : "newsletter.clear_image",
    entity: "newsletter",
    entityId: input.newsletterId,
    metadata: {
      blockIndex: input.blockIndex,
      blockType: block.type,
      slot: input.slot ?? null,
    },
  });

  revalidatePath(`/newsletters/${input.newsletterId}`);
  return { ok: true, id: input.newsletterId };
}

// ─────────────────────────────────────────────
// Toggle Field Briefing / Project Sketch visibility on a groundk_story block
// ─────────────────────────────────────────────

export interface SetGroundkStoryVisibilityInput {
  newsletterId: string;
  blockIndex: number;
  part: "fieldBriefing" | "projectSketch";
  visible: boolean;
}

// ─────────────────────────────────────────────
// Set source URL on a block or on a nested item within a block
// (news_briefing.items[i].sourceUrl, event_radar.events[i].sourceUrl,
//  tech_signal.sourceUrl / theory_to_field.sourceUrl /
//  consolidated_insight.sourceUrl).
// Empty string clears the link (renderer omits the "원문 보기" line).
// ─────────────────────────────────────────────

export interface SetBlockSourceUrlInput {
  newsletterId: string;
  blockIndex: number;
  /**
   * Targets a nested location within the block instead of the top-level
   * sourceUrl. Shape:
   *   - { itemIndex: n } → news_briefing.items[n] / event_radar.events[n]
   *   - { subKey: "inItem" | "outItem" } → in_out_comparison's two cards
   *   - { subKey: "fieldBriefing" | "projectSketch" } → groundk_story parts
   */
  itemIndex?: number;
  subKey?: string;
  url: string | null;
}

export async function setBlockSourceUrlAction(
  input: SetBlockSourceUrlInput
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const normalized =
    input.url && input.url.trim() !== "" ? input.url.trim() : "";

  const { data: row, error: fetchErr } = await supabase
    .from("newsletters")
    .select("id, status, content_json")
    .eq("id", input.newsletterId)
    .single();
  if (fetchErr || !row) {
    return { ok: false, error: "원본 호를 찾을 수 없습니다." };
  }
  if (row.status === "sent") {
    return { ok: false, error: "이미 발송된 호는 수정할 수 없습니다." };
  }

  const content = row.content_json as NewsletterContent;
  if (
    !content.blocks ||
    input.blockIndex < 0 ||
    input.blockIndex >= content.blocks.length
  ) {
    return { ok: false, error: "해당 블록을 찾을 수 없습니다." };
  }

  const block = content.blocks[input.blockIndex];
  const data = block.data as Record<string, unknown>;
  let updatedData: Record<string, unknown>;

  if (input.subKey) {
    // Named sub-section — in_out_comparison (inItem / outItem) or
    // groundk_story (fieldBriefing / projectSketch).
    const allowed: Record<string, string[]> = {
      in_out_comparison: ["inItem", "outItem"],
      groundk_story: ["fieldBriefing", "projectSketch"],
    };
    const keys = allowed[block.type];
    if (!keys || !keys.includes(input.subKey)) {
      return {
        ok: false,
        error: `${block.type} 블록은 "${input.subKey}" 하위 파트를 지원하지 않습니다.`,
      };
    }
    const sub = (data[input.subKey] as Record<string, unknown>) ?? {};
    const nextSub = { ...sub };
    if (normalized) nextSub.sourceUrl = normalized;
    else delete nextSub.sourceUrl;
    updatedData = { ...data, [input.subKey]: nextSub };
  } else if (input.itemIndex === undefined) {
    // Block-level sourceUrl (opening_lede / stat_feature / tech_signal /
    // theory_to_field / editor_take / consolidated_insight)
    updatedData = { ...data };
    if (normalized) updatedData.sourceUrl = normalized;
    else delete updatedData.sourceUrl;
  } else {
    // Nested item sourceUrl (news_briefing.items[i] / event_radar.events[i])
    const nestedKey =
      block.type === "news_briefing"
        ? "items"
        : block.type === "event_radar"
        ? "events"
        : null;
    if (!nestedKey) {
      return {
        ok: false,
        error: `${block.type} 블록은 항목별 원문 링크를 지원하지 않습니다.`,
      };
    }
    const nested = (data[nestedKey] as Array<Record<string, unknown>>) ?? [];
    if (input.itemIndex < 0 || input.itemIndex >= nested.length) {
      return { ok: false, error: "해당 항목을 찾을 수 없습니다." };
    }
    const nextNested = [...nested];
    const targetItem = { ...nextNested[input.itemIndex] };
    if (normalized) targetItem.sourceUrl = normalized;
    else delete targetItem.sourceUrl;
    nextNested[input.itemIndex] = targetItem;
    updatedData = { ...data, [nestedKey]: nextNested };
  }

  const updatedBlock = {
    ...block,
    data: updatedData,
  } as NewsletterContent["blocks"][number];
  const updatedBlocks = [...content.blocks];
  updatedBlocks[input.blockIndex] = updatedBlock;

  const { error: updErr } = await supabase
    .from("newsletters")
    .update({
      content_json: { ...content, blocks: updatedBlocks },
    })
    .eq("id", input.newsletterId);
  if (updErr) {
    return { ok: false, error: `DB 저장 실패: ${updErr.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.set_source_url",
    entity: "newsletter",
    entityId: input.newsletterId,
    metadata: {
      blockIndex: input.blockIndex,
      itemIndex: input.itemIndex ?? null,
      subKey: input.subKey ?? null,
      cleared: !normalized,
    },
  });

  revalidatePath(`/newsletters/${input.newsletterId}`);
  return { ok: true, id: input.newsletterId };
}

export async function setGroundkStoryVisibilityAction(
  input: SetGroundkStoryVisibilityInput
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: row, error: fetchErr } = await supabase
    .from("newsletters")
    .select("id, status, content_json")
    .eq("id", input.newsletterId)
    .single();
  if (fetchErr || !row) {
    return { ok: false, error: "원본 호를 찾을 수 없습니다." };
  }
  if (row.status === "sent") {
    return { ok: false, error: "이미 발송된 호는 수정할 수 없습니다." };
  }

  const content = row.content_json as NewsletterContent;
  if (
    !content.blocks ||
    input.blockIndex < 0 ||
    input.blockIndex >= content.blocks.length
  ) {
    return { ok: false, error: "해당 블록을 찾을 수 없습니다." };
  }

  const block = content.blocks[input.blockIndex];
  if (block.type !== "groundk_story") {
    return {
      ok: false,
      error: "GroundK Story 블록에서만 사용 가능합니다.",
    };
  }

  // Refuse to hide both at once — the block would render empty (just the
  // section label). Admin can remove the block entirely via the block
  // delete button instead.
  const otherPart =
    input.part === "fieldBriefing" ? "showProjectSketch" : "showFieldBriefing";
  const otherVisible =
    (block.data as Record<string, unknown>)[otherPart] !== false;
  if (!input.visible && !otherVisible) {
    return {
      ok: false,
      error:
        "두 파트 모두 숨길 수 없습니다. 블록 자체를 제거하려면 상단의 ✕ 버튼을 사용하세요.",
    };
  }

  const flagKey =
    input.part === "fieldBriefing"
      ? "showFieldBriefing"
      : "showProjectSketch";
  const updatedBlock = {
    ...block,
    data: { ...block.data, [flagKey]: input.visible },
  } as NewsletterContent["blocks"][number];

  const updatedBlocks = [...content.blocks];
  updatedBlocks[input.blockIndex] = updatedBlock;

  const { error: updErr } = await supabase
    .from("newsletters")
    .update({
      content_json: { ...content, blocks: updatedBlocks },
    })
    .eq("id", input.newsletterId);
  if (updErr) {
    return { ok: false, error: `DB 저장 실패: ${updErr.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.groundk_story_visibility",
    entity: "newsletter",
    entityId: input.newsletterId,
    metadata: {
      blockIndex: input.blockIndex,
      part: input.part,
      visible: input.visible,
    },
  });

  revalidatePath(`/newsletters/${input.newsletterId}`);
  return { ok: true, id: input.newsletterId };
}

// ─────────────────────────────────────────────
// SET IMAGE LAYOUT on a specific block
// Swaps only the imageLayout field on block.data (or on the groundk_story
// sub-slot). Leaves imageUrl intact.
// ─────────────────────────────────────────────

export interface SetBlockImageLayoutInput {
  newsletterId: string;
  blockIndex: number;
  layout: ImageLayout;
  /** groundk_story sub-part (fieldBriefing / projectSketch). */
  slot?: "fieldBriefing" | "projectSketch";
  /** event_radar events[] / news_briefing items[] index. */
  itemIndex?: number;
}

export async function setBlockImageLayoutAction(
  input: SetBlockImageLayoutInput
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  if (!(IMAGE_LAYOUTS as readonly string[]).includes(input.layout)) {
    return { ok: false, error: `알 수 없는 레이아웃: ${input.layout}` };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("newsletters")
    .select("id, status, content_json")
    .eq("id", input.newsletterId)
    .single();
  if (fetchErr || !row) {
    return { ok: false, error: "원본 호를 찾을 수 없습니다." };
  }
  if (row.status === "sent") {
    return { ok: false, error: "이미 발송된 호는 수정할 수 없습니다." };
  }

  const content = row.content_json as NewsletterContent;
  if (
    !content.blocks ||
    input.blockIndex < 0 ||
    input.blockIndex >= content.blocks.length
  ) {
    return { ok: false, error: "해당 블록을 찾을 수 없습니다." };
  }

  const block = content.blocks[input.blockIndex];
  const data = block.data as Record<string, unknown>;

  let updatedBlock: NewsletterContent["blocks"][number];
  if (block.type === "groundk_story" && input.slot) {
    const sub = (data[input.slot] ?? {}) as Record<string, unknown>;
    updatedBlock = {
      ...block,
      data: {
        ...data,
        [input.slot]: { ...sub, imageLayout: input.layout },
      },
    } as NewsletterContent["blocks"][number];
  } else if (input.itemIndex !== undefined) {
    // Nested item in an array-based block (event_radar.events /
    // news_briefing.items). Patch that single item's imageLayout.
    const nestedKey =
      block.type === "event_radar"
        ? "events"
        : block.type === "news_briefing"
        ? "items"
        : null;
    if (!nestedKey) {
      return {
        ok: false,
        error: `${block.type} 블록은 항목별 레이아웃을 지원하지 않습니다.`,
      };
    }
    const nested = (data[nestedKey] as Array<Record<string, unknown>>) ?? [];
    if (input.itemIndex < 0 || input.itemIndex >= nested.length) {
      return { ok: false, error: "해당 항목을 찾을 수 없습니다." };
    }
    const nextNested = [...nested];
    nextNested[input.itemIndex] = {
      ...nextNested[input.itemIndex],
      imageLayout: input.layout,
    };
    updatedBlock = {
      ...block,
      data: { ...data, [nestedKey]: nextNested },
    } as NewsletterContent["blocks"][number];
  } else {
    updatedBlock = {
      ...block,
      data: { ...data, imageLayout: input.layout },
    } as NewsletterContent["blocks"][number];
  }

  const updatedBlocks = [...content.blocks];
  updatedBlocks[input.blockIndex] = updatedBlock;

  const { error: updErr } = await supabase
    .from("newsletters")
    .update({
      content_json: { ...content, blocks: updatedBlocks },
    })
    .eq("id", input.newsletterId);
  if (updErr) {
    return { ok: false, error: `DB 저장 실패: ${updErr.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.set_image_layout",
    entity: "newsletter",
    entityId: input.newsletterId,
    metadata: {
      blockIndex: input.blockIndex,
      blockType: block.type,
      slot: input.slot ?? null,
      layout: input.layout,
    },
  });

  revalidatePath(`/newsletters/${input.newsletterId}`);
  return { ok: true, id: input.newsletterId };
}

// ─────────────────────────────────────────────
// REGENERATE A SINGLE BLOCK (Phase 4.3-D)
// Admin can refine one block without touching the rest.
// ─────────────────────────────────────────────

export interface RegenerateBlockInput {
  newsletterId: string;
  blockIndex: number;
  /** New admin instruction for this block. Replaces any previous one. */
  instructions: string | null;
  /** Whether to research from articles (true) or emit placeholder (false). */
  autoSearch: boolean;
  /**
   * If set (and non-empty), these exact article IDs are used as the candidate
   * pool — the normal category/date/partition filtering is bypassed. Admin's
   * explicit pick always wins. Ignored when autoSearch is false.
   */
  forcedArticleIds?: string[];
}

export async function regenerateBlockAction(
  input: RegenerateBlockInput
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: row, error: fetchErr } = await supabase
    .from("newsletters")
    .select("*")
    .eq("id", input.newsletterId)
    .single();
  if (fetchErr || !row) {
    return { ok: false, error: "원본 호를 찾을 수 없습니다." };
  }
  if (row.status === "sent") {
    return { ok: false, error: "이미 발송된 호는 수정할 수 없습니다." };
  }

  const content = row.content_json as NewsletterContent;
  if (!content.blocks || input.blockIndex < 0 || input.blockIndex >= content.blocks.length) {
    return { ok: false, error: "해당 블록을 찾을 수 없습니다." };
  }

  const targetBlock = content.blocks[input.blockIndex];
  const type = targetBlock.type;

  // Refresh the candidate article pool following this block's policy.
  // Exclude articles already claimed by OTHER blocks of this same
  // newsletter so regeneration doesn't stomp on their references.
  let articles: Article[] = [];
  if (input.autoSearch) {
    const forced = (input.forcedArticleIds ?? []).filter(Boolean);
    if (forced.length > 0) {
      // Admin explicitly picked these — bypass the category/date filters and
      // feed Claude exactly the chosen set. Category mismatch is respected
      // (the admin knows best). Preserve the order they were picked in.
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .in("id", forced);
      if (error) {
        return { ok: false, error: `기사 조회 실패: ${error.message}` };
      }
      const byId = new Map<string, Article>(
        (data ?? []).map((a) => [a.id as string, a as Article])
      );
      articles = forced
        .map((id) => byId.get(id))
        .filter((a): a is Article => !!a);
    } else {
      const policy = BLOCK_ARTICLE_POLICY[type];
      const cats = Array.from(
        new Set([...policy.primary, ...policy.fallback])
      );

      const articlesByCategory: Record<ArticleCategory, Article[]> =
        emptyArticlesByCategory();
      const articlesByCategoryAllTime: Record<ArticleCategory, Article[]> =
        emptyArticlesByCategory();

      for (const cat of cats) {
        let q = supabase
          .from("articles")
          .select("*")
          .contains("categories", [cat])
          .eq("review_status", "new")
          .order("pinned", { ascending: false })
          .order("importance", { ascending: false, nullsFirst: false })
          .order("collected_at", { ascending: false })
          .limit(policy.ignoreDateFilter ? 40 : 15);

        if (!policy.ignoreDateFilter) {
          if (row.collection_period_start) {
            q = q.gte("collected_at", row.collection_period_start);
          }
          if (row.collection_period_end) {
            const endDate = new Date(row.collection_period_end);
            endDate.setUTCDate(endDate.getUTCDate() + 1);
            q = q.lt("collected_at", endDate.toISOString());
          }
        }

        const { data, error } = await q;
        if (error) {
          return { ok: false, error: `기사 조회 실패: ${error.message}` };
        }
        if (policy.ignoreDateFilter) {
          articlesByCategoryAllTime[cat] = (data ?? []) as Article[];
        } else {
          articlesByCategory[cat] = (data ?? []) as Article[];
        }
      }

      // Articles already claimed by other blocks of this same newsletter
      const otherBlocksUsed = new Set<string>();
      content.blocks.forEach((b, i) => {
        if (i === input.blockIndex) return;
        for (const id of b.referencedArticleIds ?? []) {
          otherBlocksUsed.add(id);
        }
      });

      articles = getArticlesForBlock(
        type,
        articlesByCategory,
        policy.ignoreDateFilter ? articlesByCategoryAllTime : undefined,
        otherBlocksUsed
      );
    }
  }

  // Regenerate just this block. Passing previousData switches Claude into
  // edit-mode: the existing block content is shown in-prompt and Claude is
  // told to copy it verbatim except where the admin instruction explicitly
  // asks to change something. Full rewrites are opt-in via phrases the
  // admin types ("아예 새롭게 생성해줘" etc.).
  let result;
  try {
    result = await regenerateSingleBlock({
      type,
      issueLabel: row.issue_label,
      articles,
      instructions: input.instructions ?? undefined,
      autoSearch: input.autoSearch,
      referenceNotes: row.reference_notes ?? undefined,
      previousData: targetBlock.data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `블록 재생성 실패: ${msg}` };
  }

  // Build updated blocks array. Merge admin-managed fields from the
  // previous block's data into Claude's fresh output so uploaded images,
  // layout choices, and visibility toggles survive a regenerate.
  const mergedData = mergePreservedBlockFields(
    targetBlock.type,
    targetBlock.data as Record<string, unknown>,
    result.data as Record<string, unknown>
  );

  const updatedBlocks = [...content.blocks];
  updatedBlocks[input.blockIndex] = {
    ...targetBlock,
    data: mergedData,
    instructions: input.instructions ?? undefined,
    autoSearch: input.autoSearch,
    referencedArticleIds: result.referencedArticleIds,
  } as NewsletterContent["blocks"][number];

  const updatedContent: NewsletterContent = {
    ...content,
    blocks: updatedBlocks,
  };

  const { error: updErr } = await supabase
    .from("newsletters")
    .update({
      content_json: updatedContent,
      status: "review",
    })
    .eq("id", input.newsletterId);
  if (updErr) {
    return { ok: false, error: `DB 저장 실패: ${updErr.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.regenerate_block",
    entity: "newsletter",
    entityId: input.newsletterId,
    metadata: {
      blockIndex: input.blockIndex,
      blockType: type,
      instructions: input.instructions ?? null,
      autoSearch: input.autoSearch,
    },
  });

  revalidatePath(`/newsletters/${input.newsletterId}`);
  return { ok: true, id: input.newsletterId, message: "블록이 재생성되었습니다." };
}

// ─────────────────────────────────────────────
// ADD / REMOVE / REORDER BLOCKS (post-draft editing)
// Lets the admin shape an existing draft — insert a block that wasn't in
// the initial block picker, remove one, or nudge ordering up/down.
// ─────────────────────────────────────────────

export interface AddBlockInput {
  newsletterId: string;
  /** 0-based insert index. 0 = top, blocks.length = append. */
  position: number;
  blockType: BlockType;
  instructions: string | null;
  autoSearch: boolean;
  /** Admin-picked article IDs. When set, bypass category/date filters and
   *  use these exact articles as the candidate pool. */
  forcedArticleIds?: string[];
}

export async function addBlockAction(
  input: AddBlockInput
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  if (!(BLOCK_TYPES as readonly string[]).includes(input.blockType)) {
    return { ok: false, error: `알 수 없는 블록 타입: ${input.blockType}` };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("newsletters")
    .select("*")
    .eq("id", input.newsletterId)
    .single();
  if (fetchErr || !row) {
    return { ok: false, error: "원본 호를 찾을 수 없습니다." };
  }
  if (row.status === "sent") {
    return { ok: false, error: "이미 발송된 호는 수정할 수 없습니다." };
  }

  const content = row.content_json as NewsletterContent;
  const existingBlocks = content.blocks ?? [];
  const insertAt = Math.max(0, Math.min(input.position, existingBlocks.length));

  // Build candidate article pool for the new block (mirrors regenerateBlockAction).
  // groundk_story is admin-only — never research.
  const effectiveAutoSearch =
    input.blockType === "groundk_story" ? false : input.autoSearch;

  let articles: Article[] = [];
  if (effectiveAutoSearch) {
    const forced = (input.forcedArticleIds ?? []).filter(Boolean);
    if (forced.length > 0) {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .in("id", forced);
      if (error) {
        return { ok: false, error: `기사 조회 실패: ${error.message}` };
      }
      const byId = new Map<string, Article>(
        (data ?? []).map((a) => [a.id as string, a as Article])
      );
      articles = forced
        .map((id) => byId.get(id))
        .filter((a): a is Article => !!a);
    } else {
      const policy = BLOCK_ARTICLE_POLICY[input.blockType];
      const cats = Array.from(
        new Set([...policy.primary, ...policy.fallback])
      );

      const articlesByCategory: Record<ArticleCategory, Article[]> =
        emptyArticlesByCategory();
      const articlesByCategoryAllTime: Record<ArticleCategory, Article[]> =
        emptyArticlesByCategory();

      for (const cat of cats) {
        let q = supabase
          .from("articles")
          .select("*")
          .contains("categories", [cat])
          .eq("review_status", "new")
          .order("pinned", { ascending: false })
          .order("importance", { ascending: false, nullsFirst: false })
          .order("collected_at", { ascending: false })
          .limit(policy.ignoreDateFilter ? 40 : 15);

        if (!policy.ignoreDateFilter) {
          if (row.collection_period_start) {
            q = q.gte("collected_at", row.collection_period_start);
          }
          if (row.collection_period_end) {
            const endDate = new Date(row.collection_period_end);
            endDate.setUTCDate(endDate.getUTCDate() + 1);
            q = q.lt("collected_at", endDate.toISOString());
          }
        }

        const { data, error } = await q;
        if (error) {
          return { ok: false, error: `기사 조회 실패: ${error.message}` };
        }
        if (policy.ignoreDateFilter) {
          articlesByCategoryAllTime[cat] = (data ?? []) as Article[];
        } else {
          articlesByCategory[cat] = (data ?? []) as Article[];
        }
      }

      // Exclude articles already claimed by existing blocks
      const alreadyUsed = new Set<string>();
      for (const b of existingBlocks) {
        for (const id of b.referencedArticleIds ?? []) alreadyUsed.add(id);
      }

      articles = getArticlesForBlock(
        input.blockType,
        articlesByCategory,
        policy.ignoreDateFilter ? articlesByCategoryAllTime : undefined,
        alreadyUsed
      );
    }
  }

  let result;
  try {
    result = await regenerateSingleBlock({
      type: input.blockType,
      issueLabel: row.issue_label,
      articles,
      instructions: input.instructions ?? undefined,
      autoSearch: effectiveAutoSearch,
      referenceNotes: row.reference_notes ?? undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `블록 생성 실패: ${msg}` };
  }

  const newBlock = {
    id: randomUUID(),
    type: input.blockType,
    data: result.data,
    instructions: input.instructions ?? undefined,
    autoSearch: effectiveAutoSearch,
    referencedArticleIds: result.referencedArticleIds,
  } as NewsletterContent["blocks"][number];

  const updatedBlocks = [
    ...existingBlocks.slice(0, insertAt),
    newBlock,
    ...existingBlocks.slice(insertAt),
  ];

  const { error: updErr } = await supabase
    .from("newsletters")
    .update({
      content_json: { ...content, blocks: updatedBlocks },
      status: "review",
    })
    .eq("id", input.newsletterId);
  if (updErr) {
    return { ok: false, error: `DB 저장 실패: ${updErr.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.add_block",
    entity: "newsletter",
    entityId: input.newsletterId,
    metadata: {
      position: insertAt,
      blockType: input.blockType,
      autoSearch: effectiveAutoSearch,
      instructions: input.instructions ?? null,
    },
  });

  revalidatePath(`/newsletters/${input.newsletterId}`);
  return {
    ok: true,
    id: input.newsletterId,
    message: "블록이 추가되었습니다.",
  };
}

export async function removeBlockAction(
  newsletterId: string,
  blockIndex: number
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: row, error: fetchErr } = await supabase
    .from("newsletters")
    .select("id, status, content_json")
    .eq("id", newsletterId)
    .single();
  if (fetchErr || !row) {
    return { ok: false, error: "원본 호를 찾을 수 없습니다." };
  }
  if (row.status === "sent") {
    return { ok: false, error: "이미 발송된 호는 수정할 수 없습니다." };
  }

  const content = row.content_json as NewsletterContent;
  const blocks = content.blocks ?? [];
  if (blockIndex < 0 || blockIndex >= blocks.length) {
    return { ok: false, error: "해당 블록을 찾을 수 없습니다." };
  }
  if (blocks.length <= 1) {
    return { ok: false, error: "최소 1개의 블록은 남아 있어야 합니다." };
  }

  const removed = blocks[blockIndex];
  const updatedBlocks = [
    ...blocks.slice(0, blockIndex),
    ...blocks.slice(blockIndex + 1),
  ];

  const { error: updErr } = await supabase
    .from("newsletters")
    .update({
      content_json: { ...content, blocks: updatedBlocks },
      status: "review",
    })
    .eq("id", newsletterId);
  if (updErr) {
    return { ok: false, error: `DB 저장 실패: ${updErr.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.remove_block",
    entity: "newsletter",
    entityId: newsletterId,
    metadata: { blockIndex, blockType: removed.type },
  });

  revalidatePath(`/newsletters/${newsletterId}`);
  return { ok: true, id: newsletterId, message: "블록이 삭제되었습니다." };
}

export async function moveBlockAction(
  newsletterId: string,
  blockIndex: number,
  direction: "up" | "down"
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: row, error: fetchErr } = await supabase
    .from("newsletters")
    .select("id, status, content_json")
    .eq("id", newsletterId)
    .single();
  if (fetchErr || !row) {
    return { ok: false, error: "원본 호를 찾을 수 없습니다." };
  }
  if (row.status === "sent") {
    return { ok: false, error: "이미 발송된 호는 수정할 수 없습니다." };
  }

  const content = row.content_json as NewsletterContent;
  const blocks = [...(content.blocks ?? [])];
  const swapWith = direction === "up" ? blockIndex - 1 : blockIndex + 1;
  if (
    blockIndex < 0 ||
    blockIndex >= blocks.length ||
    swapWith < 0 ||
    swapWith >= blocks.length
  ) {
    return { ok: false, error: "이동할 수 없는 위치입니다." };
  }

  [blocks[blockIndex], blocks[swapWith]] = [
    blocks[swapWith],
    blocks[blockIndex],
  ];

  const { error: updErr } = await supabase
    .from("newsletters")
    .update({
      content_json: { ...content, blocks },
      status: "review",
    })
    .eq("id", newsletterId);
  if (updErr) {
    return { ok: false, error: `DB 저장 실패: ${updErr.message}` };
  }

  await logAudit({
    adminId: admin.id,
    action: "newsletter.move_block",
    entity: "newsletter",
    entityId: newsletterId,
    metadata: { from: blockIndex, to: swapWith },
  });

  revalidatePath(`/newsletters/${newsletterId}`);
  return { ok: true, id: newsletterId, message: "순서가 변경되었습니다." };
}
