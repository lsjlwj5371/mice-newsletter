import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { processSendQueue } from "@/lib/send-queue";
import { markArticlesUsedForSentNewsletter } from "@/lib/article-used";

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

  // 1. Enqueue any newsletters whose scheduled_at has passed and haven't
  //    been enqueued yet (no sends rows exist for them).
  const enqueueResult = await enqueueDueScheduledNewsletters(supabase);

  // 2. Re-queue stuck 'sending' rows (abandoned workers)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabase
    .from("sends")
    .update({ status: "queued" })
    .eq("status", "sending")
    .lt("queued_at", fiveMinAgo);

  // 3. Drain what we can
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
      // Cement this issue's referenced articles as "used" now that it's sent.
      await markArticlesUsedForSentNewsletter(supabase, nl.id);
    }
  }

  return NextResponse.json({ ...result, enqueued: enqueueResult });
}

/**
 * Find newsletters whose status='scheduled' and scheduled_at has passed,
 * and that have zero sends rows yet. For each, enqueue active recipients.
 * Returns a summary for observability.
 */
async function enqueueDueScheduledNewsletters(supabase: ReturnType<typeof createAdminClient>) {
  const summary = { newsletters: 0, rows: 0 };
  const nowIso = new Date().toISOString();

  const { data: due } = await supabase
    .from("newsletters")
    .select("id, scheduled_at")
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", nowIso);

  for (const nl of due ?? []) {
    // Skip if any sends already exist for this newsletter (race / idempotent)
    const { count: existing } = await supabase
      .from("sends")
      .select("*", { count: "exact", head: true })
      .eq("newsletter_id", nl.id)
      .eq("is_test", false);
    if (existing && existing > 0) continue;

    const { data: recipients } = await supabase
      .from("recipients")
      .select("id, email, name")
      .eq("status", "active");

    if (!recipients || recipients.length === 0) continue;

    const rows = recipients.map((r) => ({
      newsletter_id: nl.id,
      recipient_id: r.id,
      recipient_email: r.email,
      recipient_name: r.name,
      status: "queued" as const,
      is_test: false,
      token: crypto.randomBytes(16).toString("base64url"),
    }));

    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from("sends").insert(rows.slice(i, i + 500));
    }

    summary.newsletters++;
    summary.rows += rows.length;
  }

  return summary;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  return run();
}
export async function POST(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  return run();
}
