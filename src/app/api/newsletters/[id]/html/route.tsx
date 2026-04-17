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

  const html = await render(
    <Newsletter content={parsed.data} appUrl={appUrl} />,
    { pretty: true }
  );

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
