-- NCP(네이버 Cloud) 주소록 동기화 상태 추적 컬럼.
--
-- 네이버 Cloud 를 발송 인프라로 쓰는 워크플로우 지원:
--   · ncp_added_at    = 관리자가 NCP 주소록에 이 수신자를 추가한 시점
--   · ncp_removed_at  = 관리자가 NCP 주소록에서 이 수신자를 제거한 시점
--
-- "대기" 큐 정의:
--   · NCP 추가 대기  = status='active'  AND ncp_added_at IS NULL
--   · NCP 제거 대기  = status IN ('unsubscribed','bounced') AND ncp_removed_at IS NULL
--
-- 두 컬럼 모두 nullable — 우리 시스템만으로 발송할 때는 건드리지 않음.

ALTER TABLE recipients
  ADD COLUMN IF NOT EXISTS ncp_added_at   timestamptz,
  ADD COLUMN IF NOT EXISTS ncp_removed_at timestamptz;

-- 대기 큐 조회 성능을 위한 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_recipients_ncp_add_pending
  ON recipients (created_at DESC)
  WHERE ncp_added_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_recipients_ncp_remove_pending
  ON recipients (unsubscribed_at DESC NULLS LAST)
  WHERE ncp_removed_at IS NULL AND status IN ('unsubscribed','bounced');

COMMENT ON COLUMN recipients.ncp_added_at IS
  'Timestamp when the admin marked this recipient as added to the NCP address book. NULL = pending.';
COMMENT ON COLUMN recipients.ncp_removed_at IS
  'Timestamp when the admin marked this recipient as removed from the NCP address book. NULL = pending.';
