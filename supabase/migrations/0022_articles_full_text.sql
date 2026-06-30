-- ─────────────────────────────────────────────
-- 0022 — articles.full_text (원문 본문 캐싱)
-- ─────────────────────────────────────────────
-- 기존에는 Claude 가 본문 생성 시 후보 기사의 `title + summary(1~3문장)
-- + tags` 만 보게 되어, 본문 충실도가 떨어지고 키워드 기반 추론으로
-- 흘러가는 문제가 있었음. 수집 cron 에서 article URL 페이지를 미리
-- fetch 해 본문을 추출, 이 컬럼에 저장하여 본문 생성 시 우선 사용.
--
-- 비워 두어도 무방 (정책: 본문 추출 실패한 사이트는 NULL, 본문 생성
-- 로직이 summary 폴백). nullable, 인덱스 X, 평균 3~8KB 행당.

alter table articles
  add column if not exists full_text text;

-- 진단/디버깅용으로 본문 추출 시점/상태도 함께 저장. NULL = 미시도,
-- 비어있는 문자열 = 시도했으나 실패 (raw_excerpt 폴백 동작).
alter table articles
  add column if not exists full_text_fetched_at timestamptz;
alter table articles
  add column if not exists full_text_error text;
