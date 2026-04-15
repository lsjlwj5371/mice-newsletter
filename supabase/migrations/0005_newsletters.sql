-- ─────────────────────────────────────────────
-- Phase 4.2 — Newsletter drafts
-- ─────────────────────────────────────────────

do $$ begin
  create type newsletter_status as enum (
    'draft',      -- 작성 중 (Claude 초안 생성됨)
    'review',     -- 감수 중 (관리자 편집)
    'scheduled',  -- 예약 발송 대기
    'sent',       -- 발송 완료
    'archived'    -- 보관
  );
exception when duplicate_object then null; end $$;

create table if not exists newsletters (
  id                       uuid primary key default gen_random_uuid(),
  issue_label              text not null,
  subject                  text not null default '',
  status                   newsletter_status not null default 'draft',

  -- Schema versioning so future changes to NewsletterContent shape
  -- can be handled without breaking past drafts
  schema_version           smallint not null default 1,

  -- Full newsletter content as JSONB (matches NewsletterContent in TS)
  content_json             jsonb not null,

  -- Period used for filtering candidate articles
  collection_period_start  timestamptz,
  collection_period_end    timestamptz,

  -- Admin pre-registered references / insights for this issue
  reference_notes          text,

  -- Articles Claude picked for this draft
  used_article_ids         uuid[] not null default '{}',

  -- Send tracking (used in Phase 5)
  scheduled_at             timestamptz,
  sent_at                  timestamptz,
  rendered_html_snapshot   text,        -- HTML at send time (Phase 5)

  created_by               uuid references admins(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  last_drafted_at          timestamptz not null default now()
);

create index if not exists idx_newsletters_status     on newsletters(status);
create index if not exists idx_newsletters_created_at on newsletters(created_at desc);

-- Touch updated_at on every UPDATE
create or replace function touch_newsletters_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_newsletters_updated_at on newsletters;
create trigger trg_newsletters_updated_at
  before update on newsletters
  for each row execute function touch_newsletters_updated_at();

-- RLS — server only
alter table newsletters enable row level security;
drop policy if exists "server only" on newsletters;
create policy "server only" on newsletters
  for all using (false) with check (false);
