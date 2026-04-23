import { NextResponse, type NextRequest } from "next/server";
import { render } from "@react-email/render";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import Newsletter from "@/emails/Newsletter";
import { newsletterContentSchema } from "@/lib/validation/newsletter-content";
import type { NewsletterRow } from "@/types/newsletter";

export const dynamic = "force-dynamic";

/**
 * Download the rendered HTML for a newsletter draft.
 *
 * GET /api/newsletters/[id]/html?download=1
 *   → Content-Disposition: attachment  (force browser download)
 * GET /api/newsletters/[id]/html
 *   → inline (can be used as iframe src)
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
  const html = rawHtml
    .replaceAll("{{UNSUBSCRIBE_HREF}}", `${appUrl}/unsubscribe`)
    .replaceAll("{{REFERRAL_HREF}}", `${appUrl}/refer`);

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
