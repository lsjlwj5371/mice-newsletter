import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFeed } from "@/lib/rss/parse";
import { analyzeArticle } from "@/lib/claude/article-analyze";
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

interface RunSummary {
  ok: true;
  feeds_processed: number;
  feeds_failed: number;
  new_articles: number;
  analyzed: number;
  analysis_errors: number;
  errors: number;
  details: Array<{
    feed_id: string;
    feed_name: string;
    new_count: number;
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

      for (const item of items) {
        if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
          console.warn("[collect] soft deadline reached during item loop");
          break;
        }

        // Check if guid already exists
        const { data: existing } = await supabase
          .from("articles")
          .select("id")
          .eq("guid", item.guid)
          .maybeSingle();

        if (existing) continue;

        // Insert raw article first (without analysis)
        const { data: inserted, error: insertErr } = await supabase
          .from("articles")
          .insert({
            feed_id: feed.id,
            guid: item.guid,
            url: item.url,
            title: item.title,
            source: feed.name,
            category: feed.category as ArticleCategory,
            published_at: item.publishedAt?.toISOString() ?? null,
            raw_excerpt: item.rawExcerpt,
          })
          .select("id")
          .single();

        if (insertErr) {
          // 23505 = unique violation; race condition with another concurrent run.
          if (insertErr.code !== "23505") {
            summary.errors++;
            console.error("[collect] insert error", insertErr);
          }
          continue;
        }

        summary.new_articles++;
        detail.new_count++;

        // Analyze with Claude (best-effort; failures don't block insertion)
        try {
          const analysis = await analyzeArticle({
            title: item.title,
            url: item.url,
            category: feed.category as ArticleCategory,
            rawExcerpt: item.rawExcerpt,
            source: feed.name,
          });

          await supabase
            .from("articles")
            .update({
              summary: analysis.summary,
              tags: analysis.tags,
              importance: analysis.importance,
              analyzed_at: new Date().toISOString(),
              analysis_error: null,
            })
            .eq("id", inserted.id);

          summary.analyzed++;
        } catch (analyzeErr) {
          summary.analysis_errors++;
          const msg =
            analyzeErr instanceof Error
              ? analyzeErr.message
              : String(analyzeErr);
          console.error("[collect] analyze error", msg);
          await supabase
            .from("articles")
            .update({ analysis_error: msg.slice(0, 500) })
            .eq("id", inserted.id);
        }
      }

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
