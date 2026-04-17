-- ─────────────────────────────────────────────
-- Phase 5.1 — per-recipient send tracking
-- ─────────────────────────────────────────────
-- One row per (newsletter, recipient_email) pair describing the state
-- of that specific delivery. We key by email rather than recipient.id
-- because:
--   * test sends go to arbitrary addresses not in recipients
--   * recipient rows can be deleted later; we want the send log to
--     survive
-- recipient_id is a soft FK kept for analytics.

do $$ begin
  create type send_status as enum (
    'queued',    -- waiting for the sender worker to pick it up
    'sending',   -- claimed by a worker, in flight
    'sent',      -- Gmail API accepted the message
    'failed',    -- Gmail API returned an error
    'bounced',   -- async bounce reported later (Phase 5.3)
    'skipped'    -- recipient was unsubscribed/bounced at queue time
  );
exception when duplicate_object then null; end $$;

create table if not exists sends (
  id             uuid primary key default gen_random_uuid(),
  newsletter_id  uuid not null references newsletters(id) on delete cascade,
  recipient_id   uuid references recipients(id) on delete set null,
  recipient_email text not null,
  recipient_name  text,
  status         send_status not null default 'queued',
  /** Whether this row represents a test send (not counted in stats). */
  is_test        boolean not null default false,
  /** Unique per-send token used for unsubscribe / tracking links. */
  token          text not null unique,
  /** Gmail API message id once sent (for thread lookup + bounce match). */
  gmail_message_id text,
  /** Error string from Gmail API if status='failed'. */
  error          text,
  attempt_count  integer not null default 0,

  queued_at      timestamptz not null default now(),
  sent_at        timestamptz,
  opened_at      timestamptz,       -- Phase 5.2 will populate via tracking pixel
  bounced_at     timestamptz,

  /** Admin who triggered this send. */
  triggered_by   uuid references admins(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_sends_newsletter on sends(newsletter_id);
create index if not exists idx_sends_status_queued on sends(status) where status in ('queued', 'sending');
create index if not exists idx_sends_recipient on sends(recipient_id);
create index if not exists idx_sends_email on sends(recipient_email);

-- Upgrade recipients table: unsubscribe reason + when
alter table recipients
  add column if not exists unsubscribe_reason text;

-- RLS: server only
alter table sends enable row level security;
drop policy if exists "server only" on sends;
create policy "server only" on sends
  for all using (false) with check (false);
