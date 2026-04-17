import { NextResponse, type NextRequest } from "next/server";
import { render } from "@react-email/render";
import { requireAdmin } from "@/lib/auth-helpers";
import Newsletter from "@/emails/Newsletter";
import { sampleNewsletter } from "@/lib/sample-newsletter";

export const dynamic = "force-dynamic";

/**
 * Download the sample template HTML. Used by the /preview/newsletter page.
 */
export async function GET(req: NextRequest) {
  await requireAdmin();
  const url = new URL(req.url);
  const forceDownload = url.searchParams.get("download") === "1";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  const html = await render(
    <Newsletter content={sampleNewsletter} appUrl={appUrl} />,
    { pretty: true }
  );

  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (forceDownload) {
    headers["Content-Disposition"] = `attachment; filename="pik-newsletter-template.html"`;
  }

  return new NextResponse(html, { status: 200, headers });
}
