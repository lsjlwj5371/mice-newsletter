-- 0019 — 삭제된 기사 guid 묘비(tombstone) 테이블.
--
-- 배경:
--   collect-articles cron 의 dedup 은 `articles.guid` 만 확인하기 때문에
--   admin 이 "불필요 목록 영구 삭제" 또는 article-cleanup cron 으로 행을
--   하드 딜리트하면, RSS 피드 윈도우(보통 10~50건, 최근 1~2주) 안에 같은
--   item 이 남아있을 경우 다음 수집에서 새 기사로 인식돼 다시 들어온다.
--   archived → purge → 다시 수집 → archived → purge 무한 루프.
--
--   이 묘비 테이블은 한 번 삭제된 guid 를 60일간 기억해서 같은 item 이
--   재수집되지 않도록 막는다. RSS 피드 윈도우보다 훨씬 길어 실질적으로
--   "같은 기사는 다시 안 들어옴" 을 보장한다.

CREATE TABLE IF NOT EXISTS deleted_article_guids (
  guid       text PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

-- TTL 정리(60일 지난 묘비) 를 빠르게 돌리기 위한 인덱스.
CREATE INDEX IF NOT EXISTS idx_deleted_article_guids_at
  ON deleted_article_guids(deleted_at);

COMMENT ON TABLE deleted_article_guids IS
  'Tombstones for article GUIDs that were hard-deleted via the admin "불필요 영구 삭제" button or article-cleanup cron. Consulted by collect-articles dedup to prevent the same RSS item being re-inserted while its source feed still lists it. Rows auto-expire after 60 days via the article-cleanup cron — by then the feed window is long past so re-insertion can no longer happen anyway.';
