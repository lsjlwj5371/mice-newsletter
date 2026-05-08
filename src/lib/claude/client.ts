import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  _client = new Anthropic({ apiKey });
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
