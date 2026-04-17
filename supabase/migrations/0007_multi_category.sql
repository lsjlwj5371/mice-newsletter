-- ─────────────────────────────────────────────
-- Phase 4.3-H — multi-category support
-- ─────────────────────────────────────────────
-- A single RSS feed (e.g. PCMA Convene) may legitimately feed multiple
-- newsletter sections, so we move from a single `category` column to a
-- `categories` array on both rss_feeds and articles.
--
-- Strategy:
--   1. add new `categories article_category[]` columns with a default
--   2. backfill from the existing `category` value (array of one)
--   3. make them NOT NULL
--   4. drop the old `category` columns + their dependent indexes
-- ─────────────────────────────────────────────

-- rss_feeds ────────────────────────────────────
alter table rss_feeds
  add column if not exists categories article_category[] not null default '{}';

update rss_feeds
set categories = array[category]::article_category[]
where categories = '{}'::article_category[] and category is not null;

-- Require at least one category — enforced at app level; allow empty
-- only momentarily during this migration.
drop index if exists idx_rss_feeds_category;
create index if not exists idx_rss_feeds_categories on rss_feeds using gin (categories);

alter table rss_feeds drop column if exists category;

-- articles ────────────────────────────────────
alter table articles
  add column if not exists categories article_category[] not null default '{}';

update articles
set categories = array[category]::article_category[]
where categories = '{}'::article_category[] and category is not null;

drop index if exists idx_articles_category;
create index if not exists idx_articles_categories on articles using gin (categories);

alter table articles drop column if exists category;
