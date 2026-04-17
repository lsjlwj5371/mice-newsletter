import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/**
 * Click tracking redirect.
 *
 * GET /t/click/[token]?to=<encoded original URL>
 *
 * Flow:
 *   1. Verify the token. If invalid, still redirect to ?to= so the
 *      recipient's click isn't broken by a signing key rotation.
 *   2. Log the click in sends.click_count + click_events.
 *   3. 302 redirect to the decoded target URL.
 *
 * The ?to= param is URL-encoded at sign time. We sanity-check it's an
 * http/https URL before following.
 */
function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  // Don't store raw IPs; hash with the token secret so only we can
  // correlate (dedupe) across sends.
  const secret = process.env.TOKEN_SECRET ?? "";
  return crypto
    .createHmac("sha256", secret)
    .update(ip)
    .digest("hex")
    .slice(0, 32);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const url = new URL(req.url);
  const target = url.searchParams.get("to");

  // Validate target URL
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "missing target" },
      { status: 400 }
    );
  }
  let redirectUrl: URL;
  try {
    redirectUrl = new URL(target);
    if (!["http:", "https:"].includes(redirectUrl.protocol)) {
      throw new Error("non-http protocol");
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid target" },
      { status: 400 }
    );
  }

  const claims = verifyToken(token);
  if (claims && claims.kind === "c") {
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const { data: current } = await supabase
      .from("sends")
      .select("clicked_at, click_count")
      .eq("id", claims.sendId)
      .single();

    if (current) {
      await supabase
        .from("sends")
        .update({
          clicked_at: current.clicked_at ?? now,
          click_count: (current.click_count ?? 0) + 1,
        })
        .eq("id", claims.sendId);

      // Fire-and-forget event log
      const userAgent = req.headers.get("user-agent") ?? null;
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      await supabase.from("click_events").insert({
        send_id: claims.sendId,
        url: redirectUrl.toString(),
        user_agent: userAgent,
        ip_hash: hashIp(ip),
      });
    }
  }

  return NextResponse.redirect(redirectUrl.toString(), 302);
}
