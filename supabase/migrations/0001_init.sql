-- ─────────────────────────────────────────────
-- Phase 1 initial schema
-- admins / recipients / tokens / audit_logs
-- ─────────────────────────────────────────────

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─── Admins ────────────────────────────────────
do $$ begin
  create type admin_role as enum ('owner', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

create table if not exists admins (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete cascade,
  email         citext unique not null,
  name          text,
  role          admin_role not null default 'editor',
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- ─── Recipients ───────────────────────────────
do $$ begin
  create type recipient_status as enum ('active', 'unsubscribed', 'pending', 'bounced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recipient_source as enum ('initial', 'referral', 'manual');
exception when duplicate_object then null; end $$;

create table if not exists recipients (
  id              uuid primary key default gen_random_uuid(),
  email           citext unique not null,
  name            text,
  organization    text,
  status          recipient_status not null default 'active',
  source          recipient_source not null default 'manual',
  referred_by     uuid references recipients(id) on delete set null,
  tags            text[] not null default '{}',
  notes           text,
  created_at      timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index if not exists idx_recipients_status on recipients(status);
create index if not exists idx_recipients_created_at on recipients(created_at desc);

-- ─── Tokens (unsubscribe / referral / open / click) ───
do $$ begin
  create type token_kind as enum ('unsubscribe', 'referral', 'open', 'click');
exception when duplicate_object then null; end $$;

create table if not exists tokens (
  token         text primary key,
  kind          token_kind not null,
  recipient_id  uuid references recipients(id) on delete cascade,
  newsletter_id uuid,                              -- FK added in Phase 4
  payload       jsonb,
  expires_at    timestamptz,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_tokens_recipient on tokens(recipient_id);
create index if not exists idx_tokens_kind on tokens(kind);

-- ─── Audit logs ───────────────────────────────
create table if not exists audit_logs (
  id        bigserial primary key,
  admin_id  uuid references admins(id),
  action    text not null,
  entity    text,
  entity_id text,
  metadata  jsonb,
  at        timestamptz not null default now()
);

create index if not exists idx_audit_at on audit_logs(at desc);
create index if not exists idx_audit_admin on audit_logs(admin_id);
