-- ─────────────────────────────────────────────
-- Phase 4.3-J — newsletter image uploads
-- ─────────────────────────────────────────────
-- Create a dedicated Supabase Storage bucket for images admins upload
-- into newsletter blocks, plus a lightweight image_assets table so we
-- can:
--   * track who uploaded what, when, and where
--   * find orphaned uploads to clean up later (Phase 5 will flip them
--     to base64 at send time and then delete the originals on a 7-day
--     retention window)
-- ─────────────────────────────────────────────

-- 1. Public Storage bucket (must be public so email clients can fetch
--    the image URL — ACLs are enforced at the API route level, not
--    Storage-level, because email clients don't carry Supabase auth).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'newsletter-images',
  'newsletter-images',
  true,
  5242880, -- 5 MB per file (hard cap; we resize client-bound anyway)
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 2. image_assets — one row per uploaded file. Not directly tied to a
--    specific block instance (blocks just reference the URL in their
--    content_json), but created_by / newsletter_id / path let us find
--    orphans + enforce 7-day cleanup later.
create table if not exists image_assets (
  id              uuid primary key default gen_random_uuid(),
  path            text not null unique,            -- storage object key
  public_url      text not null,
  mime_type       text not null,
  bytes           integer not null,
  width           integer,
  height          integer,
  /** If set, this image belongs to a specific newsletter. Cleanup runs
      only touch rows whose newsletter was sent or deleted. */
  newsletter_id   uuid references newsletters(id) on delete set null,
  uploaded_by     uuid references admins(id) on delete set null,
  /** Set once this image has been embedded as base64 into a sent
      newsletter's rendered HTML; Phase 5 will use it to know the
      Storage file is safe to delete. */
  inlined_at      timestamptz,
  /** Soft delete marker; actual Storage deletion happens in a cron job
      to stay under Vercel function timeouts. */
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_image_assets_newsletter
  on image_assets(newsletter_id);
create index if not exists idx_image_assets_inlined
  on image_assets(inlined_at) where inlined_at is not null;
create index if not exists idx_image_assets_deleted
  on image_assets(deleted_at) where deleted_at is not null;

-- 3. RLS — server only. Writes go through the admin service-role client
--    in the upload route. The bucket itself is public so Supabase
--    Storage ACLs still allow anonymous read (email clients).
alter table image_assets enable row level security;
drop policy if exists "server only" on image_assets;
create policy "server only" on image_assets
  for all using (false) with check (false);
