"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import {
  ARTICLE_REVIEW_STATUSES,
  type ArticleReviewStatus,
} from "@/lib/validation/rss";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

// ─────────────────────────────────────────────
// searchArticlesForPicker — powers the "이 블록에서 특정 기사 사용" picker
// used by block regeneration / add-block / new-draft flows.
// ─────────────────────────────────────────────

export interface PickerArticle {
  id: string;
  title: string;
  source: string | null;
  categories: string[];
  published_at: string | null;
  summary: string | null;
  importance: number | null;
  pinned: boolean;
  used_in_newsletter_id: string | null;
  review_status: "new" | "archived";
}

export interface SearchArticlesInput {
  query?: string;
  category?: string;
  limit?: number;
  /** If true, include archived rows. Default false. */
  includeArchived?: boolean;
  /** If true, include already-used rows. Default false. */
  includeUsed?: boolean;
}

export async function searchArticlesForPicker(
  input: SearchArticlesInput
): Promise<{ ok: true; articles: PickerArticle[] } | { ok: false; error: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  const limit = Math.max(5, Math.min(100, input.limit ?? 50));

  let q = supabase
    .from("articles")
    .select(
      "id, title, source, categories, published_at, summary, importance, pinned, used_in_newsletter_id, review_status"
    )
    .order("pinned", { ascending: false })
    .order("importance", { ascending: false, nullsFirst: false })
    .order("collected_at", { ascending: false })
    .limit(limit);

  if (!input.includeArchived) {
    q = q.eq("review_status", "new");
  }
  if (!input.includeUsed) {
    q = q.is("used_in_newsletter_id", null);
  }
  if (input.category) {
    q = q.contains("categories", [input.category]);
  }
  if (input.query && input.query.trim()) {
    const safe = input.query.trim().replace(/[%_,]/g, "");
    q = q.or(`title.ilike.%${safe}%,summary.ilike.%${safe}%`);
  }

  const { data, error } = await q;
  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    articles: (data ?? []) as PickerArticle[],
  };
}

export async function setArticleStatusAction(
  articleId: string,
  status: ArticleReviewStatus
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!(ARTICLE_REVIEW_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: `알 수 없는 상태: ${status}` };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("articles")
    .update({ review_status: status })
    .eq("id", articleId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAudit({
    adminId: admin.id,
    action: "article.set_status",
    entity: "article",
    entityId: articleId,
    metadata: { status },
  });

  revalidatePath("/articles");
  return { ok: true };
}

// ─────────────────────────────────────────────
// BULK actions — apply a single classification change to many articles
// at once. Used by the /articles checkbox + toolbar UX so admins can
// triage a newly-collected batch in one pass.
// ─────────────────────────────────────────────

export type BulkArticleAction =
  | "archive" // review_status → archived
  | "unarchive" // review_status → new
  | "pin" // pinned = true (only for review_status='new')
  | "unpin"; // pinned = false

const MAX_BULK_IDS = 500; // hard cap to keep the query bounded

export async function applyBulkArticleAction(
  articleIds: string[],
  action: BulkArticleAction
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!Array.isArray(articleIds) || articleIds.length === 0) {
    return { ok: false, error: "선택된 기사가 없습니다." };
  }
  if (articleIds.length > MAX_BULK_IDS) {
    return {
      ok: false,
      error: `한 번에 최대 ${MAX_BULK_IDS}건까지 처리할 수 있습니다.`,
    };
  }

  const supabase = createAdminClient();
  let update: Record<string, unknown>;
  switch (action) {
    case "archive":
      // Archiving also clears the pin — a 'not needed' article shouldn't
      // still demand priority in the next issue.
      update = { review_status: "archived", pinned: false };
      break;
    case "unarchive":
      update = { review_status: "new" };
      break;
    case "pin":
      update = { pinned: true };
      break;
    case "unpin":
      update = { pinned: false };
      break;
    default:
      return { ok: false, error: `알 수 없는 동작: ${action}` };
  }

  const { error } = await supabase
    .from("articles")
    .update(update)
    .in("id", articleIds);

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAudit({
    adminId: admin.id,
    action: "article.bulk_action",
    entity: "article",
    metadata: { action, count: articleIds.length },
  });

  revalidatePath("/articles");
  return {
    ok: true,
    message: `${articleIds.length}건에 적용되었습니다.`,
  };
}

export async function toggleArticlePinAction(
  articleId: string,
  pinned: boolean
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("articles")
    .update({ pinned })
    .eq("id", articleId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAudit({
    adminId: admin.id,
    action: "article.toggle_pin",
    entity: "article",
    entityId: articleId,
    metadata: { pinned },
  });

  revalidatePath("/articles");
  return { ok: true };
}
