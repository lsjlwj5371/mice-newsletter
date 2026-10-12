import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  // 개인 키(sk-ant-usr-...)를 워크스페이스가 아니라 조직 범위로 발급하면
  // 모든 요청에 anthropic-workspace-id 헤더가 필요하다. 헤더가 없으면
  // 400 invalid_request_error 로 전부 실패한다. 키를 워크스페이스 범위로
  // 발급하는 쪽이 간단하지만, 조직 범위 키를 써야 하는 경우를 위해
  // ANTHROPIC_WORKSPACE_ID 가 있으면 헤더로 붙여 준다.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  _client = new Anthropic({
    apiKey,
    ...(workspaceId
      ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } }
      : {}),
  });
  return _client;
}

// Model used for per-article analysis. The output is small (2-3 lines
// summary + 6 tags + importance 1-5) and we run it once per RSS item,
// so latency is the bottleneck, not raw quality. Haiku 4.5 finishes in
// ~1.5-2s vs Sonnet's 3-6s, which is the difference between fitting one
// feed and fitting all feeds inside the 50s soft deadline.
export const DEFAULT_MODEL = "claude-haiku-4-5";

// Model used for newsletter draft generation. Same Haiku 4.5 — it can
// emit ~3-5K tokens well within the 60s function budget; quality is
// good enough for a first draft that the admin will edit anyway.
export const DRAFT_MODEL = "claude-haiku-4-5";
