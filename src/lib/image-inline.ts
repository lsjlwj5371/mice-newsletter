import sharp from "sharp";

/**
 * Convert <img src="..."> references in an email HTML body into inline
 * base64 data URIs.
 *
 * Why?
 *  - Recipients keep the email readable for years, even if the Supabase
 *    Storage object later gets deleted (our 7-day cleanup cron).
 *  - Removes a hard dependency on our public URL being reachable by
 *    the mail client at arbitrary future times.
 *
 * Constraints:
 *  - Only inline images whose URL lives on our own Storage bucket
 *    (NEXT_PUBLIC_SUPABASE_URL). Leave external images (including the
 *    brand logo if it's hosted outside Storage) as regular URLs so the
 *    HTML doesn't balloon.
 *  - The /public/logo.png on Vercel is considered external — we leave
 *    it as a URL too since it's never deleted.
 *  - Cap total inlined bytes at 400 KB per email. Gmail clips message
 *    bodies around ~102 KB but modern clients handle larger; we keep
 *    a safety margin while still allowing a small cover image per
 *    block. Once the cap is reached we stop inlining and leave the
 *    remaining <img> tags as URLs.
 *  - Transcode webp → PNG (alpha) / JPEG (no alpha) at inline time.
 *    Reason: classic Outlook for Windows still doesn't render webp,
 *    so even when we successfully base64-inline a webp it shows as a
 *    broken image. Storage stays webp for size; we only pay the
 *    transcode cost during send. GIFs are passed through to keep
 *    animation intact.
 *
 * Returns the rewritten HTML plus the list of Storage paths that were
 * successfully inlined (caller marks image_assets.inlined_at for each).
 */

const MAX_INLINE_TOTAL_BYTES = 400 * 1024; // 400 KB — email send default

export interface InlineResult {
  html: string;
  inlinedStoragePaths: string[];
  skippedReason: Record<string, string>;
}

export async function inlineStorageImages(params: {
  html: string;
  /** Supabase project URL — used to tell Storage URLs from external URLs. */
  supabaseUrl: string;
  /** Storage bucket name (e.g. "newsletter-images"). */
  bucket: string;
  /**
   * Total inlined-bytes budget. Defaults to 400 KB which suits the email
   * send path (Gmail clips large bodies). The archive-download path
   * passes a much larger cap so every image embeds and the saved HTML
   * file is fully self-contained — there's no inbox size limit for a
   * downloaded file.
   */
  maxBytes?: number;
  /**
   * When true, embed images from ANY HTTP(S) URL — not just our own
   * Storage bucket. Used by the archive-download path so the saved
   * HTML is fully self-contained (footer logos hosted on Vercel etc.
   * get embedded too). The default (false) preserves the email-send
   * behavior where only Storage-hosted images are inlined and stable
   * external CDNs stay as URL references.
   */
  embedAll?: boolean;
}): Promise<InlineResult> {
  const { html, supabaseUrl, bucket } = params;
  const maxBytes = params.maxBytes ?? MAX_INLINE_TOTAL_BYTES;
  const embedAll = params.embedAll ?? false;

  // 이미지가 박힐 수 있는 세 패턴을 모두 잡는다. 과거에는 <img src> 만 처리
  // 해서 MICE Insight 의 풀블리드 히어로(<td background> + CSS background-
  // image:url() 패턴)는 임베드에서 누락 → Storage 삭제 시 깨졌다. 이제는
  // 세 패턴 모두 같은 fetch/transcode 캐시를 공유하면서 일괄 치환.
  const patterns: Array<{
    /** URL 추출용 regex — 캡처 그룹 마지막에 URL 이 와야 함. */
    regex: RegExp;
    /** 매칭된 텍스트를 새 src 로 재조립. */
    rebuild: (m: RegExpMatchArray, newSrc: string) => string;
  }> = [
    {
      // <img ... src="...">
      regex: /(<img\b[^>]*?\s)src=(["'])([^"']+)\2/gi,
      rebuild: (m, src) => `${m[1]}src=${m[2]}${src}${m[2]}`,
    },
    {
      // <td background="..."> — 이메일 풀블리드 표준 패턴
      regex: /(\sbackground=)(["'])(https?:\/\/[^"']+)\2/gi,
      rebuild: (m, src) => `${m[1]}${m[2]}${src}${m[2]}`,
    },
    {
      // style="...background-image: url(https://...)..." — 모던 클라이언트
      // 백업 패턴. url() 안 URL 은 따옴표 있을 수도 없을 수도.
      regex:
        /(background-image\s*:\s*url\s*\(\s*)(["']?)(https?:\/\/[^"')\s]+)\2(\s*\))/gi,
      rebuild: (m, src) => `${m[1]}${m[2]}${src}${m[2]}${m[4]}`,
    },
  ];

  // Build a map of URL → data URI (or error reason) so repeated images
  // are only fetched once across all three patterns.
  const urlsInDoc = new Set<string>();
  for (const p of patterns) {
    const re = new RegExp(p.regex.source, p.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      // URL 은 항상 마지막 텍스트 캡처(p.regex 별로 m[3])
      urlsInDoc.add(m[3]);
    }
  }

  const storageUrlPrefix = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/`;
  const dataUriByUrl = new Map<string, string>();
  const pathByUrl = new Map<string, string>();
  const skippedReason: Record<string, string> = {};

  let totalBytes = 0;

  for (const url of urlsInDoc) {
    // embedAll=false (email send 기본값): 우리 Storage URL 만 임베드, 외부
    // CDN/Vercel 호스팅은 URL 그대로 두어 이메일 본문 비대화 방지.
    // embedAll=true (archive download): 모든 HTTP(S) 이미지 임베드 → HTML
    // 파일이 완전 자체완결, 외부 의존성 0.
    if (!embedAll && !url.startsWith(storageUrlPrefix)) {
      skippedReason[url] = "not a storage URL";
      continue;
    }
    if (totalBytes >= maxBytes) {
      skippedReason[url] = "hit per-email inline budget";
      continue;
    }

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        skippedReason[url] = `fetch failed (HTTP ${res.status})`;
        continue;
      }
      const originalMime =
        res.headers.get("content-type")?.split(";")[0]?.trim() ||
        "image/webp";
      const originalBuf = Buffer.from(await res.arrayBuffer());

      // Transcode webp → PNG (alpha) or JPEG (no alpha) for classic
      // Outlook for Windows compatibility. PNG/JPEG/GIF are passed
      // through as-is. Failures fall back to the original bytes so we
      // never block a send on a transcode glitch — but they'll then
      // render broken in Outlook (worst case = same as before this
      // change).
      // Buffer typed as `Buffer<ArrayBufferLike>` to accept both the
      // `Buffer.from(arrayBuffer)` result and sharp's output type.
      let finalBuf: Buffer<ArrayBufferLike> = originalBuf;
      let finalMime = originalMime;
      if (originalMime === "image/webp") {
        try {
          const meta = await sharp(originalBuf).metadata();
          if (meta.hasAlpha) {
            finalBuf = await sharp(originalBuf).png().toBuffer();
            finalMime = "image/png";
          } else {
            finalBuf = await sharp(originalBuf)
              .jpeg({ quality: 85 })
              .toBuffer();
            finalMime = "image/jpeg";
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[image-inline] webp transcode failed for ${url}, falling back to original: ${msg}`
          );
          // keep finalBuf / finalMime as originals
        }
      }

      if (totalBytes + finalBuf.length > maxBytes) {
        skippedReason[url] = "exceeds per-email inline budget";
        continue;
      }
      totalBytes += finalBuf.length;

      dataUriByUrl.set(
        url,
        `data:${finalMime};base64,${finalBuf.toString("base64")}`
      );
      // pathByUrl 는 우리 Storage 자산을 inlined 마킹하기 위한 식별자라
      // 외부 URL(embedAll 일 때 같이 들어온 footer 로고 등) 은 기록하지
      // 않는다. inlined_at 마킹이 외부 자산에 의도치 않게 번지지 않도록.
      if (url.startsWith(storageUrlPrefix)) {
        pathByUrl.set(url, url.slice(storageUrlPrefix.length));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      skippedReason[url] = `fetch error: ${msg}`;
    }
  }

  // Rewrite the HTML — apply each pattern's rebuild fn to its own matches,
  // using the shared dataUriByUrl cache. Patterns are independent so order
  // doesn't matter; we just sequentially run all three replaces.
  let outHtml = html;
  for (const p of patterns) {
    outHtml = outHtml.replace(p.regex, (...args) => {
      const match = args as unknown as RegExpMatchArray;
      const url = match[3];
      const dataUri = dataUriByUrl.get(url);
      if (!dataUri) return match[0];
      return p.rebuild(match, dataUri);
    });
  }

  return {
    html: outHtml,
    inlinedStoragePaths: Array.from(pathByUrl.values()),
    skippedReason,
  };
}
