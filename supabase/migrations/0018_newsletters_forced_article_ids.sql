-- 0018 — 뉴스레터 row 에 admin-forced article ID 누적 union 컬럼 추가.
--
-- 배경:
--   사용 완료 마킹(`articles.used_in_newsletter_id`)은 발송 시점에
--   `content_json.blocks[*].referencedArticleIds` 만 보고 동작했다.
--   재생성·편집 중에 Claude 가 다른 기사를 인용하면 그 배열이 새로
--   쓰여지면서, **처음 admin 이 ArticlePicker 로 명시 지정한 기사가
--   추적에서 빠지는** 버그가 있었다. 발송 후에도 그 기사는 "후보" 풀에
--   계속 노출되어 다음 호 작업에 다시 등장.
--
-- 이 컬럼은 draft 생애 동안 admin 이 forcedArticleIds 로 명시 지정한
-- 모든 ID 의 union 을 누적 보존한다. 재생성으로 한 번 referenced 에서
-- 빠져도 여기엔 남고, `markArticlesUsedForSentNewsletter` 가 발송 시
-- 두 집합의 union 을 사용 완료로 마킹한다.
--
-- 한 번 지정 → 영원히 카운트되는 단방향 누적. 의도 미회복(놓치는 비용)
-- 보다 과대 마킹(소소한 비용) 쪽이 안전하다는 트레이드오프.

ALTER TABLE newsletters
  ADD COLUMN IF NOT EXISTS forced_article_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_newsletters_forced_article_ids
  ON newsletters USING gin (forced_article_ids);

COMMENT ON COLUMN newsletters.forced_article_ids IS
  'Union of admin-forced article IDs across the draft''s lifetime. Used by markArticlesUsedForSentNewsletter alongside block.referencedArticleIds so explicitly-picked articles get marked as used even if a later regenerate dropped them from the citation set.';
