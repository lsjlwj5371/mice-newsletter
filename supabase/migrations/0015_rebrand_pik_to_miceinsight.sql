-- ─────────────────────────────────────────────
-- 0015 — Rebrand: PIK → MICE人sight
-- ─────────────────────────────────────────────
-- Admin renamed the newsletter. This migration updates:
--   1. template_settings.header.wordmark  "PIK" → "MICE人sight"
--   2. template_settings.footer.brandName "PIK by GroundK" → "MICE人sight by GroundK"
--   3. Any not-yet-sent newsletters carrying the old wordmark in their
--      header snapshot.
--   4. Any not-yet-sent newsletters carrying "PIK by GroundK" in footer.brandName.
-- Sent issues are left alone so archives reflect what went out.
-- Idempotent: safe to re-run.

-- 1) template_settings singleton
update template_settings
   set header = jsonb_set(
        header,
        '{wordmark}',
        to_jsonb('MICE人sight'::text),
        true
       ),
       footer = jsonb_set(
        footer,
        '{brandName}',
        to_jsonb('MICE人sight by GroundK'::text),
        true
       ),
       updated_at = now()
 where id = 'default'
   and (
        header ->> 'wordmark' = 'PIK'
     or footer ->> 'brandName' = 'PIK by GroundK'
       );

-- 2) Header wordmark on draft newsletters
update newsletters
   set content_json = jsonb_set(
        content_json,
        '{header,wordmark}',
        to_jsonb('MICE人sight'::text),
        true
       )
 where status <> 'sent'
   and content_json -> 'header' ->> 'wordmark' = 'PIK';

-- 3) Footer brandName on draft newsletters
update newsletters
   set content_json = jsonb_set(
        content_json,
        '{footer,brandName}',
        to_jsonb('MICE人sight by GroundK'::text),
        true
       )
 where status <> 'sent'
   and content_json -> 'footer' ->> 'brandName' = 'PIK by GroundK';
