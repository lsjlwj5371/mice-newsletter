-- ─────────────────────────────────────────────
-- Row Level Security
-- All operational tables: server-only via service role.
-- admins: each admin can read their own row.
-- ─────────────────────────────────────────────

alter table admins      enable row level security;
alter table recipients  enable row level security;
alter table tokens      enable row level security;
alter table audit_logs  enable row level security;

-- Drop existing policies so this script is idempotent
drop policy if exists "admin self read"   on admins;
drop policy if exists "server only write" on admins;
drop policy if exists "server only"       on recipients;
drop policy if exists "server only"       on tokens;
drop policy if exists "server only"       on audit_logs;

-- Admins can read their own row (used by client to know their role)
create policy "admin self read" on admins
  for select
  using (auth_user_id = auth.uid());

-- All writes to admins happen via service role (server-side upsert on login)
create policy "server only write" on admins
  for all
  using (false)
  with check (false);

-- Recipients / tokens / audit_logs: server only
create policy "server only" on recipients
  for all
  using (false)
  with check (false);

create policy "server only" on tokens
  for all
  using (false)
  with check (false);

create policy "server only" on audit_logs
  for all
  using (false)
  with check (false);

-- Note: SUPABASE_SERVICE_ROLE_KEY bypasses RLS. Server-side code in
-- src/lib/supabase/admin.ts uses it for all writes.
