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
