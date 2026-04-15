-- ─────────────────────────────────────────────
-- Phase 3 — RSS feeds + collected articles
-- ─────────────────────────────────────────────

-- Article category enum (4 newsletter sections that need fresh collection)
do $$ begin
  create type article_category as enum (
    'news',         -- News Briefing
    'mice_in_out',  -- MICE IN & OUT
    'tech',         -- TECH SIGNAL
    'theory'        -- 이론에서 현장으로
  );
exception when duplicate_object then null; end $$;

-- ─── RSS Feeds ────────────────────────────────
create table if not exists rss_feeds (
  id              uuid primary key default gen_random_uuid(),
  url             text not null unique,
  name            text not null,
  category        article_category not null,
  active          boolean not null default true,
  last_fetched_at timestamptz,
  last_error      text,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_rss_feeds_category on rss_feeds(category);
create index if not exists idx_rss_feeds_active on rss_feeds(active);

-- ─── Articles ─────────────────────────────────
create table if not exists articles (
  id                    uuid primary key default gen_random_uuid(),
  feed_id               uuid references rss_feeds(id) on delete set null,
  guid                  text not null unique,
  url                   text not null,
  title                 text not null,
  source                text,                    -- feed name snapshot
  category              article_category not null,
  published_at          timestamptz,
  collected_at          timestamptz not null default now(),

  -- Original content
  raw_excerpt           text,                    -- first ~800 chars

  -- Claude analysis (filled by collect cron)
  summary               text,
  tags                  text[] not null default '{}',
  importance            smallint check (importance is null or (importance between 1 and 5)),
  analyzed_at           timestamptz,
  analysis_error        text,

  -- Linked once used in a newsletter (FK added in Phase 4)
  used_in_newsletter_id uuid
);

create index if not exists idx_articles_category on articles(category);
create index if not exists idx_articles_collected_at on articles(collected_at desc);
create index if not exists idx_articles_published_at on articles(published_at desc);
create index if not exists idx_articles_importance on articles(importance desc);
create index if not exists idx_articles_feed on articles(feed_id);
create index if not exists idx_articles_used on articles(used_in_newsletter_id) where used_in_newsletter_id is not null;

-- ─── RLS ──────────────────────────────────────
alter table rss_feeds enable row level security;
alter table articles  enable row level security;

drop policy if exists "server only" on rss_feeds;
drop policy if exists "server only" on articles;

create policy "server only" on rss_feeds
  for all using (false) with check (false);

create policy "server only" on articles
  for all using (false) with check (false);
