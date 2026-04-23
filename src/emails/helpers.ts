/**
 * Shared rendering helpers for email template components.
 */

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Render inline emphasis while stripping any literal `**` that might have
 * slipped through from older content or an over-eager Claude response,
 * and converting newline characters into real `<br/>` tags so admins can
 * force line breaks simply by pressing Enter in a textarea or inserting
 * `\n` while editing JSON directly.
 *
 * We intentionally no longer treat `**text**` as bold — the design now
 * relies on structural hierarchy + color/weight from the tokens, not
 * inline markdown. Any existing `**` marks are just removed so the text
 * reads cleanly.
 *
 * Newline handling:
 *   HTML collapses raw `\n` to whitespace, so a newline in the source
 *   string otherwise disappears in the rendered email. By converting
 *   `\r?\n` to `<br/>` after escaping, admins get intuitive line-break
 *   control without having to know any markup.
 */
export function renderInlineHtml(s: string): string {
  if (!s) return "";
  const escaped = escapeHtml(s);
  return escaped
    .replace(/\*\*/g, "")
    .replace(/\r?\n/g, "<br/>");
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

/**
 * Split a string on newlines and return React nodes interleaved with
 * `<br/>` tags. Use for headings / titles that can't go through
 * `dangerouslySetInnerHTML` but still need admin-controlled line
 * breaks (press Enter in the UI or insert `\n` via JSON edit).
 */
import * as React from "react";
export function renderMultiline(s: string): React.ReactNode {
  if (!s) return "";
  const parts = s.split(/\r?\n/);
  return parts.map((line, i) =>
    React.createElement(
      React.Fragment,
      { key: i },
      line,
      i < parts.length - 1 ? React.createElement("br") : null
    )
  );
}
