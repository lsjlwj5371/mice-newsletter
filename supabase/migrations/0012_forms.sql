-- ─────────────────────────────────────────────
-- Phase 7 — reader-facing forms (events / feedback / surveys)
-- ─────────────────────────────────────────────
-- Admins can create forms (e.g. "4월 웨비나 신청", "독자 피드백"),
-- copy their public URL into a newsletter's CTA, and later see the
-- collected responses.
--
-- Deliberately minimal: field definitions live in JSONB so adding new
-- field types doesn't require migrations. Responses are also JSONB so
-- they stay consistent with their form's current shape.

do $$ begin
  create type form_kind as enum (
    'event',    -- event/webinar signup
    'feedback', -- open-ended feedback
    'survey',   -- multi-question poll
    'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists forms (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  kind            form_kind not null default 'feedback',
  /** Array of field definitions. Each field:
      { id: string, label: string, type: 'text'|'textarea'|'email'|'choice',
        required?: boolean, placeholder?: string, choices?: string[] } */
  fields          jsonb not null default '[]'::jsonb,
  /** Optional: tie this form to a specific newsletter issue. */
  newsletter_id   uuid references newsletters(id) on delete set null,
  /** false = not accepting submissions anymore. */
  is_open         boolean not null default true,
  /** Custom success message shown after submission. */
  success_message text,
  created_by      uuid references admins(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  closed_at       timestamptz
);

create index if not exists idx_forms_created_at on forms(created_at desc);
create index if not exists idx_forms_newsletter on forms(newsletter_id);
create index if not exists idx_forms_open on forms(is_open) where is_open = true;

-- Trigger to touch updated_at on updates
create or replace function touch_forms_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_forms_updated_at on forms;
create trigger trg_forms_updated_at
  before update on forms
  for each row execute function touch_forms_updated_at();

create table if not exists form_responses (
  id              uuid primary key default gen_random_uuid(),
  form_id         uuid not null references forms(id) on delete cascade,
  /** Flexible answer payload keyed by field.id. */
  answers         jsonb not null,
  /** If the submission came from a recipient whose email we can match. */
  recipient_id    uuid references recipients(id) on delete set null,
  recipient_email text,
  recipient_name  text,
  /** Raw metadata for diagnostics. */
  user_agent      text,
  ip_hash         text,
  submitted_at    timestamptz not null default now()
);

create index if not exists idx_form_responses_form on form_responses(form_id);
create index if not exists idx_form_responses_time on form_responses(submitted_at desc);

-- RLS: server only
alter table forms enable row level security;
alter table form_responses enable row level security;
drop policy if exists "server only" on forms;
drop policy if exists "server only" on form_responses;
create policy "server only" on forms
  for all using (false) with check (false);
create policy "server only" on form_responses
  for all using (false) with check (false);
