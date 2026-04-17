import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/**
 * 1x1 transparent GIF tracking pixel.
 *
 * Email clients request this URL when the message is displayed (with
 * images enabled). We update sends.opened_at / last_opened_at /
 * open_count and respond with the pixel bytes.
 *
 * Always returns 200 + the gif regardless of token validity so a broken
 * token never shows a broken image icon in the recipient's mail client.
 */
const GIF_1X1 = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const claims = verifyToken(token);

  if (claims && claims.kind === "o") {
    // Fire-and-forget: don't block the pixel response on DB latency
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Use an RPC-safe pattern: read, then conditionally update
    const { data: current } = await supabase
      .from("sends")
      .select("opened_at, open_count")
      .eq("id", claims.sendId)
      .single();

    if (current) {
      await supabase
        .from("sends")
        .update({
          opened_at: current.opened_at ?? now,
          last_opened_at: now,
          open_count: (current.open_count ?? 0) + 1,
        })
        .eq("id", claims.sendId);
    }
  }

  return new NextResponse(new Uint8Array(GIF_1X1), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(GIF_1X1.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
    },
  });
}
