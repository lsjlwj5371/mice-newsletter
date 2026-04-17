-- ─────────────────────────────────────────────
-- Phase 4.3-I — block-aligned category names
-- ─────────────────────────────────────────────
-- Category values now mirror block slug names from src/types/newsletter.ts
-- so admins can tag feeds/articles 1:1 against newsletter sections.
--
-- Renames:
--   news         → news_briefing
--   mice_in_out  → in_out_comparison
--   tech         → tech_signal
--   theory       → theory_to_field
--
-- New values (added lazily via text[] columns — no enum ALTER required):
--   stat_feature, editor_take, groundk_story, consolidated_insight,
--   blog_card_grid
--
-- We convert the category array columns from enum[] to text[] so adding
-- new block types in the future requires no DB migration.
-- ─────────────────────────────────────────────

-- 1) Convert column types from article_category[] to text[]
alter table rss_feeds
  alter column categories type text[]
  using categories::text[];

alter table articles
  alter column categories type text[]
  using categories::text[];

-- 2) Rename legacy category values inside the array columns
update rss_feeds
set categories = array(
  select case value
    when 'news' then 'news_briefing'
    when 'mice_in_out' then 'in_out_comparison'
    when 'tech' then 'tech_signal'
    when 'theory' then 'theory_to_field'
    else value
  end
  from unnest(categories) as value
)
where categories && array['news', 'mice_in_out', 'tech', 'theory'];

update articles
set categories = array(
  select case value
    when 'news' then 'news_briefing'
    when 'mice_in_out' then 'in_out_comparison'
    when 'tech' then 'tech_signal'
    when 'theory' then 'theory_to_field'
    else value
  end
  from unnest(categories) as value
)
where categories && array['news', 'mice_in_out', 'tech', 'theory'];

-- 3) Drop the now-unused enum type (no column references it anymore)
drop type if exists article_category cascade;
