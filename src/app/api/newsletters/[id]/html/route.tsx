import { NextResponse, type NextRequest } from "next/server";
import { render } from "@react-email/render";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import Newsletter from "@/emails/Newsletter";
import { newsletterContentSchema } from "@/lib/validation/newsletter-content";
import { inlineStorageImages } from "@/lib/image-inline";
import type { NewsletterRow } from "@/types/newsletter";

export const dynamic = "force-dynamic";

// Archive-download inline budget. Generous on purpose — a downloaded
// HTML file has no inbox size limit, so we embed every image to make
// the file fully self-contained for external archiving. 20 MB is
// plenty for a newsletter (5-7 images, even as PNG ~ a few MB total)
// while still guarding against a runaway accidentally-huge upload.
const ARCHIVE_INLINE_BUDGET = 20 * 1024 * 1024;

/**
 * Download the rendered HTML for a newsletter draft.
 *
 * GET /api/newsletters/[id]/html?download=1
 *   → Content-Disposition: attachment (force browser download).
 *     Storage-hosted images are inlined as base64 so the saved file
 *     is self-contained and survives the 7-day image-cleanup cron —
 *     suitable for archiving on an external site.
 * GET /api/newsletters/[id]/html
 *   → inline (iframe src / NCP copy). Images stay as Storage URLs.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const url = new URL(req.url);
  const forceDownload = url.searchParams.get("download") === "1";

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("newsletters")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return new NextResponse("Newsletter not found", { status: 404 });
  }

  const newsletter = data as NewsletterRow;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  // Refuse to render legacy (v1) content with the new block template
  const parsed = newsletterContentSchema.safeParse(newsletter.content_json);
  if (!parsed.success) {
    return new NextResponse(
      "This newsletter was saved with an older schema and cannot be rendered by the current template. Delete and recreate it.",
      { status: 409, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const rawHtml = await render(
    <Newsletter content={parsed.data} appUrl={appUrl} />,
    { pretty: true }
  );

  // Our internal send-queue replaces {{UNSUBSCRIBE_HREF}} and
  // {{REFERRAL_HREF}} with per-recipient signed-token URLs at send
  // time. When admins export this HTML to paste into a third-party
  // sender (e.g. Naver Cloud), those per-recipient tokens don't exist
  // yet — leaving the literal placeholders in the HTML causes the
  // unsubscribe/referral buttons to error out in the reader's client.
  // Swap them with token-less form pages hosted on this app so the
  // buttons always work: readers land on a form that asks for their
  // email and we update `recipients` from there.
  let html = rawHtml
    .replaceAll("{{UNSUBSCRIBE_HREF}}", `${appUrl}/unsubscribe`)
    .replaceAll("{{REFERRAL_HREF}}", `${appUrl}/refer`);

  // For the archive-download path only: embed Storage images as base64
  // so the saved .html is fully self-contained. The inline-preview /
  // NCP-copy path (no download param) keeps Storage URLs unchanged.
  // We intentionally do NOT mark image_assets.inlined_at here — a
  // download is not a send and must not make Storage originals eligible
  // for the 7-day cleanup cron.
  if (forceDownload) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (supabaseUrl) {
      try {
        const { html: embedded } = await inlineStorageImages({
          html,
          supabaseUrl,
          bucket: "newsletter-images",
          maxBytes: ARCHIVE_INLINE_BUDGET,
        });
        html = embedded;
      } catch (err) {
        // Embedding is best-effort: if it throws, fall back to the
        // URL-referenced HTML rather than failing the download.
        console.error(
          "[html-download] image embed failed, serving URL-referenced HTML:",
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  const safeLabel = (newsletter.issue_label || "newsletter")
    .replace(/[^a-zA-Z0-9가-힣_\- .]/g, "_")
    .slice(0, 80);

  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (forceDownload) {
    headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(
      safeLabel
    )}.html"`;
  }

  return new NextResponse(html, { status: 200, headers });
}
