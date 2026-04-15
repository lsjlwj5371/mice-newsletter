import Parser from "rss-parser";

export interface ParsedRssItem {
  guid: string;
  title: string;
  url: string;
  publishedAt: Date | null;
  rawExcerpt: string | null;
}

const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; MICE-Newsletter-Bot/1.0; +https://github.com/lsjlwj5371/mice-newsletter)",
  },
});

/**
 * Fetch and parse a single RSS feed URL into normalized items.
 * Throws on network/parse error so the caller can record `last_error`.
 */
export async function parseFeed(url: string): Promise<ParsedRssItem[]> {
  const feed = await parser.parseURL(url);
  const items = feed.items ?? [];

  const normalized: ParsedRssItem[] = [];
  for (const item of items) {
    const link = item.link ?? "";
    const title = item.title ?? "(제목 없음)";
    const guid = (item.guid ?? item.id ?? link).trim();

    if (!guid || !link) continue;

    const publishedAt = item.isoDate
      ? new Date(item.isoDate)
      : item.pubDate
      ? new Date(item.pubDate)
      : null;

    const rawText =
      item.contentSnippet ??
      stripHtml(item.content ?? "") ??
      stripHtml(item.summary ?? "") ??
      null;

    const rawExcerpt = rawText ? rawText.slice(0, 800) : null;

    normalized.push({
      guid,
      title: title.trim(),
      url: link.trim(),
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
      rawExcerpt,
    });
  }

  return normalized;
}

function stripHtml(s: string): string {
  if (!s) return "";
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
