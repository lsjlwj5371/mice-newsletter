-- ─────────────────────────────────────────────
-- Phase 5.2 — Open + click tracking
-- ─────────────────────────────────────────────
-- opened_at was added in migration 0010. Here we:
--   * add clicked_at (first click time) + click_count
--   * add last_opened_at so later opens don't overwrite first-open
--   * add open_count
--   * add an index to speed up "who hasn't opened?" queries

alter table sends
  add column if not exists clicked_at     timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists open_count     integer not null default 0,
  add column if not exists click_count    integer not null default 0;

create index if not exists idx_sends_newsletter_opened
  on sends(newsletter_id, opened_at);

-- Per-click log (one row per click event). Useful for "which link in
-- which issue gets the most traffic" reports down the road.
create table if not exists click_events (
  id          bigserial primary key,
  send_id     uuid not null references sends(id) on delete cascade,
  url         text not null,
  clicked_at  timestamptz not null default now(),
  user_agent  text,
  ip_hash     text
);

create index if not exists idx_click_events_send on click_events(send_id);
create index if not exists idx_click_events_time on click_events(clicked_at desc);

alter table click_events enable row level security;
drop policy if exists "server only" on click_events;
create policy "server only" on click_events
  for all using (false) with check (false);
