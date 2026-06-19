-- ─────────────────────────────────────────────
-- 0021 — Inquiry CTA in template_settings
-- ─────────────────────────────────────────────
-- 기존 referral_cta 와 동일한 패턴으로 inquiry_cta 컬럼 추가.
-- 푸터 바로 위에 렌더되는 "문의하기" CTA — 어드민이 /events 에서
-- 만든 폼의 /f/{token} URL 을 한 번 입력해두면 모든 호에 자동 적용된다.
--
-- 컬럼은 nullable 로 두어 기존 row (id='default') 가 그대로 살아 있되,
-- 어드민이 한 번이라도 폼을 저장하면 inquiry_cta 가 채워진다. 런타임
-- loadTemplateSettings() 가 미설정 시 FALLBACK 으로 폼이 없는 상태를
-- 채워준다.

alter table template_settings
  add column if not exists inquiry_cta jsonb;

-- 기본 메시지·라벨로 빈 url 박힌 inquiry_cta 시드 (어드민이 폼 URL 만
-- 채워넣으면 바로 동작). url 이 비어있는 동안 렌더러는 버튼을 숨김.
update template_settings
   set inquiry_cta = jsonb_build_object(
     'message', '뉴스레터에 대해 문의·피드백이 있으시다면 아래 버튼을 통해 알려주세요.',
     'buttonLabel', '문의하기',
     'buttonHref', ''
   )
 where id = 'default'
   and inquiry_cta is null;
