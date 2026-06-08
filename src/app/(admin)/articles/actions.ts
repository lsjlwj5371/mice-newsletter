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

// ─────────────────────────────────────────────
// PURGE — 불필요(archived) 분류된 후보 기사를 DB 에서 즉시 영구 삭제.
//
// 관리자가 "불필요" 탭에서 정리 마무리할 때 한 번에 비우는 용도. 매일 도는
// article-cleanup cron 은 "30일 + 미사용 + 미고정" 인 행만 정리하므로,
// 막 archived 로 분류한 행은 30일을 기다려야 사라진다. 이 액션은 그 기다림
// 없이 admin 의 명시적 의도로 즉시 비우는 경로.
//
// 안전 조건 (cron 과 동일):
//   · review_status = 'archived'
//   · used_in_newsletter_id IS NULL    — 발송 호가 참조하면 삭제 금지
//   · pinned = false                   — 다음 호 예약 표시는 안전 차원
// ─────────────────────────────────────────────
export async function purgeArchivedArticlesAction(): Promise<
  ActionResult & { deleted?: number; protected?: number }
> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // 삭제 후보를 먼저 카운트해 응답 메시지에 사용.
  const { data: targets, error: selectErr } = await supabase
    .from("articles")
    .select("id, used_in_newsletter_id, pinned")
    .eq("review_status", "archived");

  if (selectErr) {
    return { ok: false, error: `조회 실패: ${selectErr.message}` };
  }

  const all = targets ?? [];
  const deletable = all.filter(
    (r) => r.used_in_newsletter_id === null && r.pinned === false
  );
  const protectedCount = all.length - deletable.length;

  if (deletable.length === 0) {
    await logAudit({
      adminId: admin.id,
      action: "article.purge_archived",
      entity: "article",
      metadata: { deleted: 0, protected: protectedCount },
    });
    return {
      ok: true,
      deleted: 0,
      protected: protectedCount,
      message:
        protectedCount > 0
          ? `삭제 가능한 행이 없습니다 (보호된 행 ${protectedCount}건).`
          : "삭제할 행이 없습니다.",
    };
  }

  const { error: deleteErr, count } = await supabase
    .from("articles")
    .delete({ count: "exact" })
    .eq("review_status", "archived")
    .is("used_in_newsletter_id", null)
    .eq("pinned", false);

  if (deleteErr) {
    return { ok: false, error: `삭제 실패: ${deleteErr.message}` };
  }

  const deleted = count ?? deletable.length;

  await logAudit({
    adminId: admin.id,
    action: "article.purge_archived",
    entity: "article",
    metadata: { deleted, protected: protectedCount },
  });

  revalidatePath("/articles");
  return {
    ok: true,
    deleted,
    protected: protectedCount,
    message:
      protectedCount > 0
        ? `${deleted}건 영구 삭제 (사용 완료/고정된 ${protectedCount}건은 보존).`
        : `${deleted}건 영구 삭제했습니다.`,
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
