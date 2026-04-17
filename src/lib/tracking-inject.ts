import { clickTrackingUrl, openPixelUrl } from "@/lib/tokens";

/**
 * Rewrite all `href` attributes in an email HTML so that clicks go
 * through our /t/click/:token proxy, then append a 1x1 tracking pixel
 * right before </body>.
 *
 * We don't touch:
 *   - `mailto:` / `tel:` links (let the mail client handle them)
 *   - Links to our own unsubscribe endpoint (the token there is
 *     different and shouldn't be double-wrapped)
 *   - Links that already start with the click wrapper path (idempotent)
 *   - Data URIs and anchor-only fragments (`#...`)
 */
export function injectTracking(params: {
  html: string;
  sendId: string;
  email: string;
  appUrl: string;
}): string {
  const { html, sendId, email, appUrl } = params;

  const unsubscribePrefix = `${appUrl}/u/`;
  const clickPrefix = `${appUrl}/t/click/`;
  const unsubscribePostPrefix = `${appUrl}/api/unsubscribe/`;

  // 1) Rewrite href="..." attributes
  let out = html.replace(
    /(<a\b[^>]*?\s)href=(["'])([^"']+)\2/gi,
    (match, preamble, quote, originalUrl) => {
      const decoded = String(originalUrl);
      if (
        decoded.startsWith("mailto:") ||
        decoded.startsWith("tel:") ||
        decoded.startsWith("#") ||
        decoded.startsWith("data:") ||
        decoded.startsWith(unsubscribePrefix) ||
        decoded.startsWith(unsubscribePostPrefix) ||
        decoded.startsWith(clickPrefix)
      ) {
        return match;
      }
      try {
        // Only wrap http(s) URLs
        const u = new URL(decoded);
        if (u.protocol !== "http:" && u.protocol !== "https:") return match;
      } catch {
        return match;
      }
      const wrapped = clickTrackingUrl(sendId, email, appUrl, decoded);
      return `${preamble}href=${quote}${wrapped}${quote}`;
    }
  );

  // 2) Append the open-tracking pixel right before </body>
  const pixelSrc = openPixelUrl(sendId, email, appUrl);
  const pixelTag = `<img src="${pixelSrc}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;margin:0;padding:0;overflow:hidden;" />`;

  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${pixelTag}</body>`);
  } else {
    out = out + pixelTag;
  }

  return out;
}
