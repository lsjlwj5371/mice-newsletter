import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily cleanup of articles that have aged out without being used.
 *
 * Safety rules — a row is deleted only when ALL of the following hold:
 *   1. `collected_at < NOW() - RETENTION_DAYS`  (it's been sitting unused)
 *   2. `used_in_newsletter_id IS NULL`           (never sent in a newsletter)
 *   3. `pinned = false`                          (admin didn't flag for next draft)
 *
 * Rows that were actually used in a sent newsletter stay forever so the
 * newsletter history page can still resolve referencedArticleIds. Pinned
 * rows are spared because the admin explicitly marked them for the next
 * draft — clearing the pin happens automatically on send (0013), so a
 * pinned-but-aged row usually means a forgotten draft that's better left
 * for the admin to clean up manually.
 */
const RETENTION_DAYS = 30;

interface RunSummary {
  ok: true;
  retention_days: number;
  cutoff_iso: string;
  deleted: number;
  by_review_status: { new: number; archived: number };
}

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

async function run(): Promise<RunSummary> {
  const supabase = createAdminClient();
  const cutoffIso = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Look up matching rows first so we can return a breakdown by
  // review_status. Cheap thanks to idx_articles_collected_at.
  const { data: targets, error: selectErr } = await supabase
    .from("articles")
    .select("id, review_status")
    .lt("collected_at", cutoffIso)
    .is("used_in_newsletter_id", null)
    .eq("pinned", false);

  if (selectErr) {
    throw new Error(`Failed to query targets: ${selectErr.message}`);
  }

  const byReviewStatus = { new: 0, archived: 0 };
  for (const row of targets ?? []) {
    if (row.review_status === "archived") byReviewStatus.archived++;
    else byReviewStatus.new++;
  }

  if ((targets ?? []).length === 0) {
    return {
      ok: true,
      retention_days: RETENTION_DAYS,
      cutoff_iso: cutoffIso,
      deleted: 0,
      by_review_status: byReviewStatus,
    };
  }

  // Delete in one statement. We don't need DELETE RETURNING because we
  // already have the count from the SELECT above.
  const { error: deleteErr, count } = await supabase
    .from("articles")
    .delete({ count: "exact" })
    .lt("collected_at", cutoffIso)
    .is("used_in_newsletter_id", null)
    .eq("pinned", false);

  if (deleteErr) {
    throw new Error(`Failed to delete: ${deleteErr.message}`);
  }

  return {
    ok: true,
    retention_days: RETENTION_DAYS,
    cutoff_iso: cutoffIso,
    deleted: count ?? targets?.length ?? 0,
    by_review_status: byReviewStatus,
  };
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  try {
    const summary = await run();
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  try {
    const summary = await run();
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
