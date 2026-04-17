import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processSendQueue } from "@/lib/send-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily cron that drains the pending send queue across all newsletters.
 * On Vercel Hobby, schedule limits are one-per-day but we run the same
 * handler as a fallback to catch orphaned `sending` rows left by crashed
 * invocations.
 *
 * Each invocation:
 *   * picks up any rows stuck in 'sending' (from a previous crashed
 *     worker) and re-queues them if they've been sending > 5 min
 *   * drains up to PER_INVOCATION_LIMIT queued rows
 *   * marks any newsletters whose queue fully drained as 'sent'
 */
function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized" },
    { status: 401 }
  );
}

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  return Boolean(process.env.CRON_SECRET) && auth === expected;
}

async function run(): Promise<NextResponse> {
  const supabase = createAdminClient();

  // Re-queue stuck 'sending' rows (abandoned workers)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabase
    .from("sends")
    .update({ status: "queued" })
    .eq("status", "sending")
    .lt("queued_at", fiveMinAgo);

  // Drain what we can
  const result = await processSendQueue({
    supabase,
    deadlineMs: Date.now() + 55_000,
  });

  // Promote newsletters whose queues are now empty to 'sent'
  const { data: scheduledNewsletters } = await supabase
    .from("newsletters")
    .select("id")
    .eq("status", "scheduled");

  for (const nl of scheduledNewsletters ?? []) {
    const { count } = await supabase
      .from("sends")
      .select("*", { count: "exact", head: true })
      .eq("newsletter_id", nl.id)
      .in("status", ["queued", "sending"]);

    if (!count || count === 0) {
      await supabase
        .from("newsletters")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", nl.id);
    }
  }

  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  return run();
}
export async function POST(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  return run();
}
