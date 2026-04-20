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
  const { data: nl, error } = await supabase
    .from("newsletters")
    .select("content_json")
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
