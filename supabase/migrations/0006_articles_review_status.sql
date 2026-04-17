-- ─────────────────────────────────────────────
-- Phase 4.3-G — admin review workflow for collected articles
-- ─────────────────────────────────────────────
-- Adds two pieces of state on each article:
--   review_status : 'new' (default, still under review)
--                   'archived' (admin marked as 'not needed' — excluded
--                                from future candidate pools)
--   pinned        : if true, admin wants this article forcibly included
--                   in the candidate pool of the NEXT draft (priority).
--                   Typically cleared manually or automatically after
--                   the article appears in a sent issue.
--
-- 'used' is already represented by the existing used_in_newsletter_id
-- FK-ish column, so it's not a review_status value.

do $$ begin
  create type article_review_status as enum ('new', 'archived');
exception when duplicate_object then null; end $$;

alter table articles
  add column if not exists review_status article_review_status not null default 'new',
  add column if not exists pinned boolean not null default false;

create index if not exists idx_articles_review_status on articles(review_status);
create index if not exists idx_articles_pinned_true on articles(pinned) where pinned = true;
