import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/tokens";
import { logAudit } from "@/lib/audit";

/**
 * POST handler for RFC 8058 List-Unsubscribe=One-Click.
 *
 * Gmail/Apple Mail hit this URL *automatically* when the user clicks
 * the "Unsubscribe" button rendered in the inbox UI, without the user
 * ever visiting the page. Must respond 200 quickly.
 *
 * This lives under /api/ because Next.js 15 doesn't allow coexisting
 * page.tsx and route.ts in the same segment, and we want /u/[token]
 * to keep rendering the confirmation page for human clicks.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const claims = verifyToken(token);

  if (!claims || claims.kind !== "u") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: sendRow } = await supabase
    .from("sends")
    .select("id, recipient_email, recipient_id, newsletter_id")
    .eq("id", claims.sendId)
    .single();

  const email = sendRow?.recipient_email ?? claims.email;

  const { data: recipient } = await supabase
    .from("recipients")
    .select("id, status")
    .ilike("email", email)
    .maybeSingle();

  if (recipient && recipient.status !== "unsubscribed") {
    await supabase
      .from("recipients")
      .update({
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
        unsubscribe_reason: "one_click_header",
      })
      .eq("id", recipient.id);

    await logAudit({
      adminId: null,
      action: "recipient.self_unsubscribe",
      entity: "recipient",
      entityId: recipient.id,
      metadata: {
        email,
        method: "list-unsubscribe-post",
        sendId: claims.sendId,
        newsletterId: sendRow?.newsletter_id ?? null,
      },
    });
  }

  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
