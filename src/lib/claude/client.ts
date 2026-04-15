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

// Default model for article analysis. Sonnet 4.5 gives best quality;
// can be downgraded to Haiku for cost optimization later.
export const DEFAULT_MODEL = "claude-sonnet-4-5";
