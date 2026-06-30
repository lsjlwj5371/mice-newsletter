import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFeed } from "@/lib/rss/parse";
import { analyzeArticle } from "@/lib/claude/article-analyze";
import { fetchArticleBody } from "@/lib/fetch-reference";
import type { ArticleCategory, RssFeed } from "@/lib/validation/rss";

// This route can be called by:
// 1) Vercel Cron (daily) — uses the system token in the `Authorization` header
//    (Vercel signs cron requests automatically OR we verify CRON_SECRET ourselves)
// 2) Admin manual trigger (server action via fetch)
// Both paths must include `Authorization: Bearer <CRON_SECRET>`.

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby allows up to 60s

// Per-call processing budget. Each Claude analysis takes ~2-4s.
// 15 items × 3s = ~45s — fits inside the 60s function timeout with margin.
const MAX_ITEMS_PER_FEED_PER_RUN = 15;
const SOFT_DEADLINE_MS = 50_000; // bail out before Vercel kills us

// Articles whose Claude-assigned importance is at or below this value
// get filtered out at ingestion time — they don't reach the articles
// table. Analyzer failures (no importance returned) are still saved so
// the admin can review them manually. Raise/lower this to tune signal.
const LOW_IMPORTANCE_THRESHOLD = 2;

interface RunSummary {
  ok: true;
  feeds_processed: number;
  feeds_failed: number;
  new_articles: number;
  analyzed: number;
  analysis_errors: number;
  /** Articles dropped because Claude rated importance <= LOW_IMPORTANCE_THRESHOLD. */
  skipped_low_importance: number;
  errors: number;
  details: Array<{
    feed_id: string;
    feed_name: string;
    new_count: number;
    skipped_low_importance?: number;
    error?: string;
  }>;
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
  // Vercel Cron sends a signed header `x-vercel-cron-signature` AND we set Authorization
  // via `vercel.json`. Either way, our manual trigger always sends `Authorization: Bearer ...`.
  return Boolean(process.env.CRON_SECRET) && auth === expected;
}

async function runCollection(): Promise<RunSummary> {
  const supabase = createAdminClient();
  const startedAt = Date.now();

  // Fetch all active feeds
  const { data: feeds, error: feedsErr } = await supabase
    .from("rss_feeds")
    .select("*")
    .eq("active", true);

  if (feedsErr) {
    throw new Error(`Failed to load feeds: ${feedsErr.message}`);
  }

  const summary: RunSummary = {
    ok: true,
    feeds_processed: 0,
    feeds_failed: 0,
    new_articles: 0,
    analyzed: 0,
    analysis_errors: 0,
    skipped_low_importance: 0,
    errors: 0,
    details: [],
  };

  for (const feed of (feeds ?? []) as RssFeed[]) {
    // Stop processing more feeds if we're close to the function timeout
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
      console.warn("[collect] soft deadline reached, stopping early");
      break;
    }

    summary.feeds_processed++;
    const detail: RunSummary["details"][number] = {
      feed_id: feed.id,
      feed_name: feed.name,
      new_count: 0,
    };

    try {
      const allItems = await parseFeed(feed.url);

      // Sort newest first so we always grab the freshest items when truncating.
      allItems.sort((a, b) => {
        const ta = a.publishedAt?.getTime() ?? 0;
        const tb = b.publishedAt?.getTime() ?? 0;
        return tb - ta;
      });

      // Cap items per feed per run to fit inside the function timeout.
      const items = allItems.slice(0, MAX_ITEMS_PER_FEED_PER_RUN);
      const feedCategories = (feed.categories ?? []) as ArticleCategory[];

      // ─── Bulk dedup — one round trip per source instead of N per item ───
      // 1) `articles` 에 이미 있는 guid 는 당연히 스킵.
      // 2) `deleted_article_guids` 묘비에 있는 guid 도 스킵 — admin 이 영구
      //    삭제했거나 cleanup cron 이 청소한 기사가 RSS 피드 윈도우 안에
      //    아직 남아있어도 재수집되지 않도록.
      const guids = items.map((i) => i.guid);
      let existingGuids = new Set<string>();
      if (guids.length > 0) {
        const [existingRes, tombstoneRes] = await Promise.all([
          supabase.from("articles").select("guid").in("guid", guids),
          supabase
            .from("deleted_article_guids")
            .select("guid")
            .in("guid", guids),
        ]);
        existingGuids = new Set([
          ...((existingRes.data ?? []).map((r) => r.guid as string)),
          ...((tombstoneRes.data ?? []).map((r) => r.guid as string)),
        ]);
      }
      const newItems = items.filter((i) => !existingGuids.has(i.guid));

      if (newItems.length === 0) {
        // Nothing new — still mark as fetched and move on.
        await supabase
          .from("rss_feeds")
          .update({
            last_fetched_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", feed.id);
        summary.details.push(detail);
        continue;
      }

      // ─── Analyze first, then conditionally insert ───
      // We now run Claude analysis on every new item up front and only
      // insert into `articles` if the assigned importance is above
      // LOW_IMPORTANCE_THRESHOLD. Low-signal items are dropped before
      // they ever reach the candidate list. Analyzer failures (no
      // importance returned) are kept so the admin can review them.
      // Analysis still runs in parallel per feed — with Haiku 4.5 at
      // ~1.5-2s per call, 15 items finish in ~2-3s wall-clock.
      const analyses = await Promise.all(
        newItems.map(async (item) => {
          try {
            const analysis = await analyzeArticle({
              title: item.title,
              url: item.url,
              category: (feedCategories[0] ?? "news_briefing") as ArticleCategory,
              rawExcerpt: item.rawExcerpt,
              source: feed.name,
            });
            return { item, analysis, error: null as string | null };
          } catch (analyzeErr) {
            const msg =
              analyzeErr instanceof Error
                ? analyzeErr.message
                : String(analyzeErr);
            console.error("[collect] analyze error", msg);
            return {
              item,
              analysis: null,
              error: msg.slice(0, 500) as string | null,
            };
          }
        })
      );

      // Partition: keep = analyzer failed OR importance > threshold.
      const toInsert = analyses.filter(
        (a) =>
          a.error !== null ||
          (a.analysis !== null && a.analysis.importance > LOW_IMPORTANCE_THRESHOLD)
      );
      const skippedLow = analyses.length - toInsert.length;
      summary.skipped_low_importance += skippedLow;
      if (skippedLow > 0) detail.skipped_low_importance = skippedLow;

      // ─── Fetch article bodies in parallel ───
      // Pre-cache the real article body so Claude has the full text when
      // generating newsletter blocks — without this, the model only sees
      // title + 1~3-sentence summary, which produces keyword-shaped
      // hallucinations instead of source-faithful prose. Per-URL timeout
      // 8s, 12000-char cap (matches fetch-reference.ts internals). Run
      // ALL fetches in parallel — feed loop already capped at 15 items
      // so worst case is 15 concurrent connections per feed iteration.
      // Failures fall back to NULL full_text with an error string saved
      // for admin diagnostics; the article still lands in the table.
      const bodyFetches = await Promise.all(
        toInsert.map(async ({ item }) => {
          try {
            const res = await fetchArticleBody(item.url);
            return res.ok
              ? { full_text: res.text ?? null, full_text_error: null }
              : { full_text: null, full_text_error: res.error ?? "unknown" };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { full_text: null, full_text_error: msg.slice(0, 500) };
          }
        })
      );

      // Bulk upsert. `ignoreDuplicates` swallows the rare race-loss when
      // a parallel collection run inserts the same GUID first. The `data`
      // we get back is the set of rows that actually landed, which lets
      // us count accurately.
      let insertedCount = 0;
      if (toInsert.length > 0) {
        const nowIso = new Date().toISOString();
        const rows = toInsert.map(({ item, analysis, error }, i) => ({
          feed_id: feed.id,
          guid: item.guid,
          url: item.url,
          title: item.title,
          source: feed.name,
          categories: feedCategories,
          published_at: item.publishedAt?.toISOString() ?? null,
          raw_excerpt: item.rawExcerpt,
          summary: analysis?.summary ?? null,
          tags: analysis?.tags ?? null,
          importance: analysis?.importance ?? null,
          analyzed_at: analysis ? nowIso : null,
          analysis_error: error,
          full_text: bodyFetches[i].full_text,
          full_text_fetched_at: nowIso,
          full_text_error: bodyFetches[i].full_text_error,
        }));

        const { data: insertedRows, error: insertErr } = await supabase
          .from("articles")
          .upsert(rows, { onConflict: "guid", ignoreDuplicates: true })
          .select("id");

        if (insertErr) {
          console.error("[collect] bulk insert error", insertErr);
          summary.errors++;
        } else {
          insertedCount = insertedRows?.length ?? 0;
        }
      }

      // Tally inserted/analyzed/errored against actual DB outcome. Race
      // losses (insertedCount < toInsert.length) are silently absorbed.
      const analyzedInserted = toInsert.filter(
        (a) => a.error === null && a.analysis !== null
      ).length;
      summary.new_articles += insertedCount;
      detail.new_count += insertedCount;
      // Approximate split — bulk upsert doesn't tell us which specific
      // rows raced. In practice race-losses are rare, so this is accurate.
      summary.analyzed += Math.min(analyzedInserted, insertedCount);
      summary.analysis_errors += Math.max(
        0,
        insertedCount - analyzedInserted
      );

      // Mark feed as successfully fetched
      await supabase
        .from("rss_feeds")
        .update({
          last_fetched_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", feed.id);
    } catch (err) {
      summary.feeds_failed++;
      summary.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      detail.error = msg;
      console.error(`[collect] feed ${feed.name} failed:`, msg);

      await supabase
        .from("rss_feeds")
        .update({
          last_fetched_at: new Date().toISOString(),
          last_error: msg.slice(0, 500),
        })
        .eq("id", feed.id);
    }

    summary.details.push(detail);
  }

  return summary;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  try {
    const summary = await runCollection();
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  try {
    const summary = await runCollection();
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
