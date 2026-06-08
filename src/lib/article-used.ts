import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewsletterContent } from "@/types/newsletter";

/**
 * Mark the articles that a fully-sent newsletter ended up referencing as
 * `used_in_newsletter_id = newsletterId`, and clear their `pinned` flag.
 *
 * Called at the moment a newsletter's status transitions to 'sent' — either
 * from the synchronous send path (small recipient lists drain in one request)
 * or the async cron drain path (queue fully emptied across runs).
 *
 * Idempotent: safe to call twice — the UPDATE is a no-op on already-matching
 * rows.
 *
 * Intentionally NOT called at draft creation / regeneration time — the admin
 * may discard a draft, so only actually-sent issues should count as "used".
 */
export async function markArticlesUsedForSentNewsletter(
  supabase: SupabaseClient,
  newsletterId: string
): Promise<{ updated: number }> {
  // content_json 으로부터 현재 인용된 ID 와, draft 생애 동안 admin 이
  // ArticlePicker 로 명시 지정한 ID 의 누적 union(`forced_article_ids`,
  // 마이그레이션 0018) 두 가지를 모두 가져온다. 후자는 재생성 도중
  // 인용에서 빠진 기사라도 admin 의 의도를 존중해 사용 완료로 마킹하기
  // 위한 보조 소스.
  const { data: nl, error } = await supabase
    .from("newsletters")
    .select("content_json, forced_article_ids")
    .eq("id", newsletterId)
    .single();

  if (error || !nl) {
    return { updated: 0 };
  }

  const content = nl.content_json as NewsletterContent | null;
  const ids = new Set<string>();
  for (const block of content?.blocks ?? []) {
    for (const id of block.referencedArticleIds ?? []) {
      if (id) ids.add(id);
    }
  }
  // Admin 누적 forced union 도 합쳐서 사용 완료 후보로.
  const forced = (nl.forced_article_ids as string[] | null) ?? [];
  for (const id of forced) {
    if (id) ids.add(id);
  }
  if (ids.size === 0) {
    return { updated: 0 };
  }

  const idArray = Array.from(ids);
  const { error: updErr } = await supabase
    .from("articles")
    .update({
      used_in_newsletter_id: newsletterId,
      pinned: false,
    })
    .in("id", idArray);

  if (updErr) {
    console.error(
      "[article-used] mark failed",
      newsletterId,
      updErr.message
    );
    return { updated: 0 };
  }
  return { updated: idArray.length };
}

/**
 * Reverse of `markArticlesUsedForSentNewsletter`. Called when a newsletter
 * is deleted before it was sent, so the articles it temporarily claimed
 * return to the candidate pool.
 *
 * Only touches rows currently pointing at this newsletter — won't disturb
 * articles that were used by other (already sent) newsletters.
 */
export async function unmarkArticlesUsedForNewsletter(
  supabase: SupabaseClient,
  newsletterId: string
): Promise<{ updated: number }> {
  const { error, count } = await supabase
    .from("articles")
    .update({ used_in_newsletter_id: null }, { count: "exact" })
    .eq("used_in_newsletter_id", newsletterId);

  if (error) {
    console.error(
      "[article-used] unmark failed",
      newsletterId,
      error.message
    );
    return { updated: 0 };
  }
  return { updated: count ?? 0 };
}
