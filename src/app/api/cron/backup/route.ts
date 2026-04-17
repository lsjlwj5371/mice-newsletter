import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily DB snapshot → Supabase Storage `db-backups` bucket.
 *
 * Design:
 *   - JSON snapshot (one object per table) named YYYY-MM-DD.json.
 *   - We keep hot tables in full (recipients, newsletters, forms, form_responses,
 *     rss_feeds, admins) and bound large high-churn tables by a recent window
 *     (sends: 90d, audit_logs: 30d, articles: skip — re-derivable from RSS).
 *   - Retention: delete snapshots older than RETENTION_DAYS.
 *   - Requires CRON_SECRET bearer. Safe to call manually.
 *
 * To restore: download the JSON, use psql / Supabase SQL editor to `insert`
 * each table section. Schema is defined by migrations; snapshot is data only.
 */

const BUCKET = "db-backups";
const RETENTION_DAYS = 30;

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

type TableSpec = {
  name: string;
  /** ISO column to bound a rolling window, if any */
  timeCol?: string;
  days?: number;
};

const TABLES: TableSpec[] = [
  { name: "admins" },
  { name: "recipients" },
  { name: "rss_feeds" },
  { name: "newsletters" },
  { name: "forms" },
  { name: "form_responses" },
  { name: "sends", timeCol: "created_at", days: 90 },
  { name: "audit_logs", timeCol: "at", days: 30 },
];

async function ensureBucket(
  supabase: ReturnType<typeof createAdminClient>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (data && !error) return { ok: true };
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: false,
  });
  if (createErr) {
    return { ok: false, error: createErr.message };
  }
  return { ok: true };
}

async function dumpTable(
  supabase: ReturnType<typeof createAdminClient>,
  spec: TableSpec
): Promise<{ rows: unknown[]; truncated: boolean }> {
  // Page through to avoid PostgREST default 1000-row cap.
  const pageSize = 1000;
  const all: unknown[] = [];
  let from = 0;
  for (let i = 0; i < 50; i++) {
    let q = supabase
      .from(spec.name)
      .select("*")
      .order("created_at", { ascending: true, nullsFirst: true })
      .range(from, from + pageSize - 1);

    if (spec.timeCol && spec.days) {
      const sinceIso = new Date(
        Date.now() - spec.days * 24 * 60 * 60 * 1000
      ).toISOString();
      q = q.gte(spec.timeCol, sinceIso);
    }
    const { data, error } = await q;
    // Some tables don't have created_at — fall back to an unordered scan.
    if (error && /created_at/i.test(error.message)) {
      const { data: d2, error: e2 } = await supabase
        .from(spec.name)
        .select("*")
        .range(from, from + pageSize - 1);
      if (e2) throw new Error(`${spec.name}: ${e2.message}`);
      all.push(...(d2 ?? []));
      if (!d2 || d2.length < pageSize) return { rows: all, truncated: false };
      from += pageSize;
      continue;
    }
    if (error) throw new Error(`${spec.name}: ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) {
      return { rows: all, truncated: false };
    }
    from += pageSize;
  }
  // Hit the page cap — signal that more rows exist beyond this snapshot.
  return { rows: all, truncated: true };
}

async function pruneOldBackups(
  supabase: ReturnType<typeof createAdminClient>
): Promise<number> {
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 1000 });
  if (error || !files) return 0;

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const toDelete: string[] = [];
  for (const f of files) {
    const created = f.created_at ? new Date(f.created_at).getTime() : 0;
    if (created && created < cutoff) toDelete.push(f.name);
  }
  if (toDelete.length === 0) return 0;
  const { error: delErr } = await supabase.storage
    .from(BUCKET)
    .remove(toDelete);
  if (delErr) return 0;
  return toDelete.length;
}

async function run(): Promise<NextResponse> {
  const supabase = createAdminClient();

  const bucketRes = await ensureBucket(supabase);
  if (!bucketRes.ok) {
    return NextResponse.json(
      { ok: false, error: `bucket: ${bucketRes.error}` },
      { status: 500 }
    );
  }

  const snapshot: Record<string, unknown> = {
    taken_at: new Date().toISOString(),
    retention_days: RETENTION_DAYS,
    tables: {},
  };
  const summary: Record<string, { count: number; truncated: boolean }> = {};

  for (const spec of TABLES) {
    try {
      const { rows, truncated } = await dumpTable(supabase, spec);
      (snapshot.tables as Record<string, unknown>)[spec.name] = rows;
      summary[spec.name] = { count: rows.length, truncated };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary[spec.name] = { count: -1, truncated: false };
      (snapshot.tables as Record<string, unknown>)[spec.name] = {
        error: msg,
      };
    }
  }

  const body = JSON.stringify(snapshot);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const path = `${today}.json`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, {
      contentType: "application/json",
      upsert: true,
    });

  if (upErr) {
    return NextResponse.json(
      { ok: false, error: `upload: ${upErr.message}`, summary },
      { status: 500 }
    );
  }

  const pruned = await pruneOldBackups(supabase);

  return NextResponse.json({
    ok: true,
    path,
    sizeBytes: body.length,
    summary,
    pruned,
  });
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  return run();
}
export async function POST(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  return run();
}
