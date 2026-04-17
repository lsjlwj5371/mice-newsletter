import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily cleanup of Supabase Storage image originals that were already
 * inlined into sent newsletters.
 *
 * Safety rules:
 *   - Only delete image_assets rows where inlined_at < (now - 7 days)
 *     AND deleted_at IS NULL. The 7-day window lets admins still see
 *     the original images while diagnosing a send or forwarding an
 *     issue.
 *   - Storage delete is attempted first; only on success do we mark
 *     the row's deleted_at (so retries work on transient Storage
 *     failures).
 *   - Skip rows with inlined_at IS NULL — those images are still in
 *     active drafts and must not be deleted.
 */
const RETENTION_DAYS = 7;
const DELETE_BATCH_LIMIT = 100;

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
  const cutoffIso = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: candidates, error: fetchErr } = await supabase
    .from("image_assets")
    .select("id, path")
    .not("inlined_at", "is", null)
    .lt("inlined_at", cutoffIso)
    .is("deleted_at", null)
    .limit(DELETE_BATCH_LIMIT);

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 }
    );
  }

  const rows = candidates ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  // Remove in bulk from Storage
  const paths = rows.map((r) => r.path);
  const { error: storageErr } = await supabase.storage
    .from("newsletter-images")
    .remove(paths);

  if (storageErr) {
    return NextResponse.json(
      { ok: false, error: `storage remove failed: ${storageErr.message}` },
      { status: 500 }
    );
  }

  // Mark rows as deleted (keep the row for audit; storage object is gone)
  const nowIso = new Date().toISOString();
  const ids = rows.map((r) => r.id);
  const { error: updErr } = await supabase
    .from("image_assets")
    .update({ deleted_at: nowIso })
    .in("id", ids);

  if (updErr) {
    return NextResponse.json(
      {
        ok: true,
        deleted: rows.length,
        warning: `storage cleaned but DB mark failed: ${updErr.message}`,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, deleted: rows.length });
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  return run();
}
export async function POST(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  return run();
}
