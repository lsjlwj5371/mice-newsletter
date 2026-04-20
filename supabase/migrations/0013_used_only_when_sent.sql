-- ─────────────────────────────────────────────
-- 0013 — articles.used_in_newsletter_id is now set ONLY when the referenced
--        newsletter has actually been sent. Previously the column was
--        written eagerly at draft creation, which let discarded drafts
--        permanently mark articles as "사용 완료".
--
-- This migration re-aligns existing rows to the new policy:
--   1. Clear used_in_newsletter_id where the pointed newsletter is NOT in
--      status='sent' (drafts, review, scheduled, archived-without-send).
--   2. Clear used_in_newsletter_id where the pointed newsletter no longer
--      exists (dangling reference from deleted drafts).
--   3. For sent newsletters, (re)apply used_in_newsletter_id to every
--      article referenced by any block's referencedArticleIds — idempotent.
-- ─────────────────────────────────────────────

-- Step 1 + 2: clear pointers to non-sent or deleted newsletters
update articles
   set used_in_newsletter_id = null
 where used_in_newsletter_id is not null
   and (
         used_in_newsletter_id not in (select id from newsletters where status = 'sent')
       );

-- Step 3: re-apply for each sent newsletter based on the current
-- content_json.blocks[*].referencedArticleIds union.
do $$
declare
  nl record;
  article_ids uuid[];
begin
  for nl in
    select id, content_json
      from newsletters
     where status = 'sent'
       and content_json is not null
  loop
    -- Gather every referencedArticleIds entry across all blocks.
    select array_agg(distinct elem::uuid)
      into article_ids
      from jsonb_array_elements(nl.content_json -> 'blocks') block,
           jsonb_array_elements_text(block -> 'referencedArticleIds') elem
     where elem <> '';

    if article_ids is not null and array_length(article_ids, 1) > 0 then
      update articles
         set used_in_newsletter_id = nl.id,
             pinned = false
       where id = any(article_ids)
         and (used_in_newsletter_id is distinct from nl.id or pinned = true);
    end if;
  end loop;
end $$;
