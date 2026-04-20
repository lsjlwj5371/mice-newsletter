/**
 * Admin-pasted reference URL fetcher.
 *
 * When the admin drops a URL into a block's `instructions` or the global
 * `referenceNotes`, Claude by itself can't browse it and will invent
 * content to fit. This module fetches the page server-side, extracts
 * readable text, and hands it back so the prompt builder can include
 * the actual article body as first-party evidence.
 *
 * Design notes
 * ────────────
 * - Per-URL timeout so one slow site can't starve the 60s function budget.
 * - Max bytes cap on the response to protect memory.
 * - Strips <script>/<style> blocks + inline HTML tags, collapses whitespace.
 * - Best-effort: fetch failures are swallowed and returned as
 *   `{ ok: false }` so the caller can skip or surface a diagnostic
 *   without blowing up draft generation.
 */

const FETCH_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 512 * 1024; // 512KB — plenty for an article
const MAX_EXTRACTED_CHARS = 12_000; // ~3-4 printed pages
const MAX_URLS_PER_CALL = 6; // hard cap to bound latency

export interface FetchedReference {
  url: string;
  ok: boolean;
  title?: string;
  text?: string;
  error?: string;
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

/** Pull unique URLs out of a free-text block. Trailing punctuation stripped. */
export function extractUrls(...sources: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const s of sources) {
    if (!s) continue;
    const matches = s.match(URL_RE);
    if (!matches) continue;
    for (const raw of matches) {
      const cleaned = raw.replace(/[.,;:!?)>\]]+$/g, "");
      seen.add(cleaned);
    }
  }
  return Array.from(seen).slice(0, MAX_URLS_PER_CALL);
}

function stripHtml(html: string): { title: string | null; text: string } {
  // Pull <title> if present
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim()
    : null;

  // Remove script/style/noscript
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  // Prefer <article> body when available — news sites typically wrap their
  // main content there, cutting out navigation/footer noise.
  const articleMatch = withoutScripts.match(
    /<article[^>]*>([\s\S]*?)<\/article>/i
  );
  const mainHtml = articleMatch ? articleMatch[1] : withoutScripts;

  const text = decodeEntities(
    mainHtml
      .replace(/<\/(p|div|li|tr|h\d|br)>/gi, "$&\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\r\f]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text: text.slice(0, MAX_EXTRACTED_CHARS) };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

async function fetchOne(url: string): Promise<FetchedReference> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MICE-Newsletter-Bot/1.0; +https://github.com/lsjlwj5371/mice-newsletter)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return { url, ok: false, error: `HTTP ${res.status}` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!/html|xml|text/i.test(contentType)) {
      return { url, ok: false, error: `지원되지 않는 타입: ${contentType}` };
    }

    // Read body with size cap
    const reader = res.body?.getReader();
    if (!reader) {
      return { url, ok: false, error: "응답 본문 없음" };
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (received >= MAX_RESPONSE_BYTES) {
          await reader.cancel();
          break;
        }
      }
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const html = buf.toString("utf-8");

    const { title, text } = stripHtml(html);
    if (!text || text.length < 80) {
      return {
        url,
        ok: false,
        error: "본문을 충분히 추출하지 못함 (JS 렌더 페이지 가능성)",
      };
    }
    return { url, ok: true, title: title ?? url, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { url, ok: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch every URL in parallel with per-URL timeouts. Returns results in
 * input order so prompt builders can cite "[R1]", "[R2]" deterministically.
 */
export async function fetchReferences(
  urls: string[]
): Promise<FetchedReference[]> {
  if (urls.length === 0) return [];
  const capped = urls.slice(0, MAX_URLS_PER_CALL);
  return Promise.all(capped.map(fetchOne));
}

/**
 * Format fetched references for direct inclusion in a Claude prompt.
 * Uses [R1], [R2], ... labels to make it easy to ask Claude to cite
 * them. Failed fetches are rendered as a short note so Claude doesn't
 * silently ignore the admin's pasted URL.
 */
export function formatReferencesForPrompt(
  refs: FetchedReference[]
): string | null {
  if (refs.length === 0) return null;
  const parts: string[] = [];
  refs.forEach((r, i) => {
    const label = `[R${i + 1}]`;
    if (r.ok) {
      parts.push(
        `${label} ${r.title ?? r.url}\n    URL: ${r.url}\n    본문:\n${r.text}`
      );
    } else {
      parts.push(
        `${label} ${r.url}\n    (본문 자동 수집 실패: ${r.error}) — 관리자에게 실제 내용을 입력받지 못했으므로 이 링크의 내용을 임의로 추정하지 마십시오.`
      );
    }
  });
  return parts.join("\n\n");
}
