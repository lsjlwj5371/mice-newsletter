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

// Default model for article analysis (small per-call, quality matters
// since this is the raw summarization layer).
export const DEFAULT_MODEL = "claude-sonnet-4-5";

// Model used for newsletter draft generation. Needs to complete within
// Vercel Hobby's 60s function timeout, so we use the faster Haiku 4.5
// which can emit ~3-5K tokens well within the budget. Quality is still
// good for a first draft — admin can edit/regenerate as needed.
export const DRAFT_MODEL = "claude-haiku-4-5";
