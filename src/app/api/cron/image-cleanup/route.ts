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
 *   - Skip rows whose Storage path is currently referenced by the
 *     singleton template_settings row (header.wordmarkLogoUrl,
 *     footer.logoSrc). Those are template-level assets shared across
 *     every newsletter and must persist indefinitely — without this
 *     guard the first send marks them inlined and 7 days later the
 *     logo silently 404s on every subsequent send.
 */
const RETENTION_DAYS = 7;
const DELETE_BATCH_LIMIT = 100;
const BUCKET = "newsletter-images";

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

/** Pull the Storage path out of a public URL, or return null for non-Storage URLs. */
function pathFromStorageUrl(
  url: string | null | undefined,
  supabaseUrl: string
): string | null {
  if (!url) return null;
  const prefix = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

async function run(): Promise<NextResponse> {
  const supabase = createAdminClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // ─── Collect template-protected paths ────────────────────────────
  // These are owned by the singleton template_settings row and must
  // survive the 7-day inlined-at cutoff. Without this guard the first
  // newsletter send marks them inlined, and the next cleanup run wipes
  // them — breaking the logo on every future send.
  const protectedPaths = new Set<string>();
  try {
    const { data: tpl } = await supabase
      .from("template_settings")
      .select("header, footer")
      .eq("id", "default")
      .maybeSingle();
    if (tpl) {
      const header = (tpl.header ?? {}) as Record<string, unknown>;
      const footer = (tpl.footer ?? {}) as Record<string, unknown>;
      const candidates = [
        typeof header.wordmarkLogoUrl === "string" ? header.wordmarkLogoUrl : null,
        typeof footer.logoSrc === "string" ? footer.logoSrc : null,
      ];
      for (const url of candidates) {
        const p = pathFromStorageUrl(url, supabaseUrl);
        if (p) protectedPaths.add(p);
      }
    }
  } catch {
    // If template lookup fails we proceed without the guard — better
    // to risk one cleanup miss than to block the cron entirely. The
    // first send after a logo re-upload regenerates the protected set.
  }

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

  const rowsAll = candidates ?? [];
  const rows = rowsAll.filter((r) => !protectedPaths.has(r.path));
  const skippedTemplate = rowsAll.length - rows.length;

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      deleted: 0,
      skipped_template_protected: skippedTemplate,
    });
  }

  // Remove in bulk from Storage
  const paths = rows.map((r) => r.path);
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
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
        skipped_template_protected: skippedTemplate,
        warning: `storage cleaned but DB mark failed: ${updErr.message}`,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    deleted: rows.length,
    skipped_template_protected: skippedTemplate,
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
