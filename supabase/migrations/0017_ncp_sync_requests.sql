-- NCP 동기화 큐를 recipients 테이블과 완전히 분리.
--
-- 배경:
--   본 admin 콘솔은 뉴스레터 제작과 발송 트리거(기사 사용완료 처리용)에만 사용하고
--   실제 발송과 수신자 리스트는 NCP(네이버 클라우드)에서 관리한다. 단, NCP에서
--   구독자 추천/수신 거부 폼을 운영하기 어렵기 때문에, 뉴스레터에 박힌
--   추천/거부 링크는 우리 콘솔이 받아서 NCP 동기화 큐로만 흘려보내고,
--   관리자가 수기로 NCP 주소록에 반영한 뒤 '처리 완료' 로 마킹한다.
--
--   이 큐는 recipients 테이블과 데이터적으로 격리된다:
--     · 외부 사용자의 추천/거부 신청 → ncp_sync_requests 만 변경, recipients 무관
--     · 관리자의 recipients 직접 수정 → recipients 만 변경, ncp_sync_requests 무관
--
--   recipients.ncp_added_at / ncp_removed_at 컬럼은 deprecated 상태로 남겨두며
--   읽기/쓰기 모두 멈춘다. 추후 별도 마이그레이션에서 제거.

-- ─── 0. 큐 테이블 ───
CREATE TABLE IF NOT EXISTS ncp_sync_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type    text NOT NULL CHECK (request_type IN ('add', 'remove')),
  email           text NOT NULL,
  name            text,
  organization    text,
  /** /r/[token] 추천 링크로 들어온 경우 추천한 기존 수신자의 이메일 (없으면 NULL) */
  referrer_email  text,
  /**
   * 어떤 경로로 들어온 요청인지 추적용:
   *   add:    'referral_self'     — 토큰리스 /refer 폼
   *           'referral_token'    — /r/[token] 추천 링크
   *   remove: 'self_form'         — 토큰리스 /unsubscribe 폼
   *           'one_click_link'    — /u/[token] 링크 클릭
   *           'one_click_header'  — RFC 8058 List-Unsubscribe POST
   */
  source_kind     text NOT NULL,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  /** NULL = 대기. 관리자가 NCP 반영 후 '처리 완료' 클릭 시 채워짐. */
  completed_at    timestamptz,
  completed_by    uuid REFERENCES admins(id) ON DELETE SET NULL,
  notes           text
);

-- ─── 1. 인덱스 ───
-- 같은 이메일·종류로 동시에 두 개의 대기 요청이 생기지 않도록.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ncp_sync_pending
  ON ncp_sync_requests (lower(email), request_type)
  WHERE completed_at IS NULL;

-- 대기 큐 조회 (request_type 별 최신순)
CREATE INDEX IF NOT EXISTS idx_ncp_sync_pending_recent
  ON ncp_sync_requests (request_type, requested_at DESC)
  WHERE completed_at IS NULL;

-- 완료 이력 조회 (request_type 별 처리 완료 시각 최신순)
CREATE INDEX IF NOT EXISTS idx_ncp_sync_done_recent
  ON ncp_sync_requests (request_type, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- ─── 2. RLS ───
-- service_role 만 접근(서버 사이드 admin 클라이언트 전용). 일반 사용자는 못 봄.
ALTER TABLE ncp_sync_requests ENABLE ROW LEVEL SECURITY;

-- ─── 3. 직전 커밋(0c8dc85) 잔여 데이터 정리 ───
-- 0c8dc85 시점에 self-signup 된 행은 recipients.status='pending', source='referral'
-- 로 들어가 있었음. 이 데이터를 새 큐로 옮긴 뒤 recipients 에서 제거하여
-- 양 테이블이 더 이상 섞이지 않도록 정리.
INSERT INTO ncp_sync_requests (
  request_type, email, name, organization, referrer_email,
  source_kind, requested_at
)
SELECT
  'add',
  r.email,
  r.name,
  r.organization,
  ref.email AS referrer_email,
  CASE WHEN r.referred_by IS NOT NULL THEN 'referral_token' ELSE 'referral_self' END,
  r.created_at
FROM recipients r
LEFT JOIN recipients ref ON ref.id = r.referred_by
WHERE r.status = 'pending'
  AND r.source = 'referral'
ON CONFLICT DO NOTHING;

DELETE FROM recipients
WHERE status = 'pending' AND source = 'referral';
