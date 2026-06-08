-- 0020 — newsletters.is_special: 특별호 플래그.
--
-- 배경:
--   기본 호 생성 흐름은 createDraftWithBlocksAction 이 issueNumber 를 받아
--   content_json.header.issueNumber 에 박고 다음 호 추천 번호는 전체 카운트
--   기반(`/newsletters/new` 페이지의 computeNextIssueNumber). 정규 시퀀스가
--   아닌 특별호(창간호 기념, 이벤트 한정 등) 는 VOL 번호를 부여하지 않고
--   다음 정규 호의 번호도 영향받지 않아야 한다.
--
--   `is_special = true` 인 행은:
--     · 헤더 렌더링: issueNumber 가 비어있어 IssueMetaBadge 의 legacy 분기
--       가 동작 → "ISSUE / 특별호" 형태로 표시 (renderer 무변경)
--     · 다음 호 번호 추천: 카운트에서 제외 → 정규 시퀀스 보존
--     · 기존 행은 default false 로 모두 정규로 취급 — 호환성 유지

ALTER TABLE newsletters
  ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_newsletters_is_special
  ON newsletters(is_special) WHERE is_special = true;

COMMENT ON COLUMN newsletters.is_special IS
  'Special-edition flag. When true, the newsletter is excluded from the regular VOL sequence — its content_json.header.issueNumber is left unset and the next-issue suggestion ignores this row when counting.';
