/**
 * Shared rendering helpers for email template components.
 */

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Render inline emphasis while stripping any literal `**` that might have
 * slipped through from older content or an over-eager Claude response.
 *
 * We intentionally no longer treat `**text**` as bold — the design now
 * relies on structural hierarchy + color/weight from the tokens, not
 * inline markdown. Any existing `**` marks are just removed so the text
 * reads cleanly.
 */
export function renderInlineHtml(s: string): string {
  if (!s) return "";
  const escaped = escapeHtml(s);
  // Strip any stray ** markers that Claude or legacy content might have
  // left behind. We no longer render them as <strong>.
  return escaped.replace(/\*\*/g, "").replace(/<br>/g, "<br/>");
}

/**
 * Plain-text version that strips markdown emphasis. Use in places that
 * can't accept HTML (rare) — most renderers should use renderInlineHtml
 * with dangerouslySetInnerHTML.
 */
export function cleanText(s: string): string {
  if (!s) return "";
  return s.replace(/\*\*/g, "");
}
