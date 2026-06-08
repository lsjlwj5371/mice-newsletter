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
// 묘비(deleted_article_guids) TTL — RSS 피드 윈도우(보통 1~2주)보다 훨씬 길어
// 사실상 영구. 60일 지난 묘비는 아무 영향 없는 죽은 데이터이므로 함께 청소.
const TOMBSTONE_RETENTION_DAYS = 60;

interface RunSummary {
  ok: true;
  retention_days: number;
  cutoff_iso: string;
  deleted: number;
  by_review_status: { new: number; archived: number };
  tombstones_expired: number;
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
  // review_status and capture guids for tombstoning.
  const { data: targets, error: selectErr } = await supabase
    .from("articles")
    .select("id, guid, review_status")
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

  // 60일 지난 묘비는 자동 정리. RSS 피드 윈도우 한참 지난 시점이라 더는
  // 필요 없음. 본 작업과 무관한 부수 cleanup 이라 결과에 카운트만 노출.
  const tombstoneCutoffIso = new Date(
    Date.now() - TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { count: tombstonesExpired } = await supabase
    .from("deleted_article_guids")
    .delete({ count: "exact" })
    .lt("deleted_at", tombstoneCutoffIso);

  if ((targets ?? []).length === 0) {
    return {
      ok: true,
      retention_days: RETENTION_DAYS,
      cutoff_iso: cutoffIso,
      deleted: 0,
      by_review_status: byReviewStatus,
      tombstones_expired: tombstonesExpired ?? 0,
    };
  }

  // Delete in one statement.
  const { error: deleteErr, count } = await supabase
    .from("articles")
    .delete({ count: "exact" })
    .lt("collected_at", cutoffIso)
    .is("used_in_newsletter_id", null)
    .eq("pinned", false);

  if (deleteErr) {
    throw new Error(`Failed to delete: ${deleteErr.message}`);
  }

  // 묘비 기록 — purge 버튼과 같은 이유. cron 이 지우는 행은 보통 30일+ 이라
  // RSS 피드에 거의 안 남지만, 일관성·방어용으로 함께 기록.
  const tombstones = (targets ?? [])
    .map((r) => r.guid)
    .filter((g): g is string => typeof g === "string" && g.length > 0)
    .map((guid) => ({ guid }));
  if (tombstones.length > 0) {
    const { error: tombErr } = await supabase
      .from("deleted_article_guids")
      .upsert(tombstones, { onConflict: "guid", ignoreDuplicates: true });
    if (tombErr) {
      console.error(
        "[article-cleanup] tombstone insert failed",
        tombErr.message
      );
    }
  }

  return {
    ok: true,
    retention_days: RETENTION_DAYS,
    cutoff_iso: cutoffIso,
    deleted: count ?? targets?.length ?? 0,
    by_review_status: byReviewStatus,
    tombstones_expired: tombstonesExpired ?? 0,
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
