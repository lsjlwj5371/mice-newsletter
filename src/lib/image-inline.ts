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

const MAX_INLINE_TOTAL_BYTES = 400 * 1024; // 400 KB per email

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
}): Promise<InlineResult> {
  const { html, supabaseUrl, bucket } = params;

  // Match <img ... src="..."> attrs, capturing both quoted and double-quoted
  const imgSrcPattern = /(<img\b[^>]*?\s)src=(["'])([^"']+)\2/gi;

  // Build a map of URL → data URI (or error reason) so repeated images
  // are only fetched once.
  const urlsInDoc = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(imgSrcPattern.source, imgSrcPattern.flags);
  while ((m = re.exec(html)) !== null) {
    urlsInDoc.add(m[3]);
  }

  const storageUrlPrefix = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/`;
  const dataUriByUrl = new Map<string, string>();
  const pathByUrl = new Map<string, string>();
  const skippedReason: Record<string, string> = {};

  let totalBytes = 0;

  for (const url of urlsInDoc) {
    // Only inline our own Storage bucket URLs
    if (!url.startsWith(storageUrlPrefix)) {
      skippedReason[url] = "not a storage URL";
      continue;
    }
    if (totalBytes >= MAX_INLINE_TOTAL_BYTES) {
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

      if (totalBytes + finalBuf.length > MAX_INLINE_TOTAL_BYTES) {
        skippedReason[url] = "exceeds per-email inline budget";
        continue;
      }
      totalBytes += finalBuf.length;

      dataUriByUrl.set(
        url,
        `data:${finalMime};base64,${finalBuf.toString("base64")}`
      );
      // Extract storage path (everything after the bucket prefix)
      pathByUrl.set(url, url.slice(storageUrlPrefix.length));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      skippedReason[url] = `fetch error: ${msg}`;
    }
  }

  // Rewrite the HTML using the lookup table.
  const outHtml = html.replace(
    imgSrcPattern,
    (match, preamble, quote, originalUrl) => {
      const dataUri = dataUriByUrl.get(originalUrl);
      if (!dataUri) return match;
      return `${preamble}src=${quote}${dataUri}${quote}`;
    }
  );

  return {
    html: outHtml,
    inlinedStoragePaths: Array.from(pathByUrl.values()),
    skippedReason,
  };
}
