-- ─────────────────────────────────────────────
-- 0014 — editable newsletter template defaults
-- ─────────────────────────────────────────────
-- Lets the admin edit the fixed header / referralCta / footer that every
-- new newsletter draft starts from, without touching code. Singleton row
-- (id='default') keeps the query pattern trivial.
--
-- Side effect: clears the "MICE · PCO · Event Industry" eyebrow from any
-- non-sent draft currently carrying it, per the first request in this
-- change. Sent issues are left untouched (historical accuracy).

create table if not exists template_settings (
  id          text primary key,             -- always 'default' for now
  header      jsonb not null,               -- { wordmark, tagline, industryTag, description }
  referral_cta jsonb not null,              -- { message, buttonLabel, buttonHref }
  footer      jsonb not null,               -- { brandName, brandTagline, links[], unsubscribeHref, logoSrc? }
  updated_at  timestamptz not null default now(),
  updated_by  uuid references admins(id)
);

-- Seed the singleton with the current (post-change) defaults.
insert into template_settings (id, header, referral_cta, footer)
values (
  'default',
  jsonb_build_object(
    'wordmark', 'PIK',
    'tagline', 'We pick what moves you',
    'industryTag', '',
    'description', '업계 종사자를 위한 인사이트 레터 · by GroundK'
  ),
  jsonb_build_object(
    'message', '지금부터 드리는 정보가 유익하셨거나, 함께 받으면 좋을 분이 떠오르셨다면 알려주세요. 다음 호부터 그분께도 전달해드리겠습니다.',
    'buttonLabel', '추천하기',
    'buttonHref', '{{REFERRAL_HREF}}'
  ),
  jsonb_build_object(
    'brandName', 'PIK by GroundK',
    'brandTagline', 'We pick what moves you',
    'links', jsonb_build_array(
      jsonb_build_object('label', 'groundk.co.kr', 'href', 'https://groundk.co.kr'),
      jsonb_build_object('label', 'triseup.com', 'href', 'https://triseup.com'),
      jsonb_build_object('label', 'rideus.co.kr', 'href', 'https://rideus.co.kr')
    ),
    'unsubscribeHref', '{{UNSUBSCRIBE_HREF}}'
  )
)
on conflict (id) do nothing;

-- Retroactively clear industryTag on not-yet-sent drafts so they match
-- the new template immediately. Sent drafts stay as-archived.
update newsletters
   set content_json = jsonb_set(
     content_json,
     '{header,industryTag}',
     '""',
     true
   )
 where status != 'sent'
   and content_json -> 'header' ->> 'industryTag' is not null
   and content_json -> 'header' ->> 'industryTag' <> '';
