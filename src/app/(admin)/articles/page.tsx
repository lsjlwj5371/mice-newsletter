import { PageHeader } from "@/components/admin/page-header";
import { ArticleList } from "@/components/articles/article-list";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  ARTICLE_CATEGORIES,
  type Article,
} from "@/lib/validation/rss";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  category?: string;
  min_importance?: string;
  /** 'new' | 'pinned' | 'used' | 'archived' | undefined(all) */
  view?: string;
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = createAdminClient();

  const view = params.view ?? "new";

  let query = supabase
    .from("articles")
    .select("*")
    .order("pinned", { ascending: false })
    .order("collected_at", { ascending: false });

  // View filter: which status bucket to show
  if (view === "pinned") {
    query = query.eq("pinned", true).eq("review_status", "new");
  } else if (view === "archived") {
    query = query.eq("review_status", "archived");
  } else if (view === "used") {
    query = query.not("used_in_newsletter_id", "is", null);
  } else if (view === "new") {
    // "검토 대기" — not archived, not used
    query = query.eq("review_status", "new").is("used_in_newsletter_id", null);
  }
  // view=all → no status filter

  if (
    params.category &&
    (ARTICLE_CATEGORIES as readonly string[]).includes(params.category)
  ) {
    query = query.eq("category", params.category);
  }

  if (params.min_importance) {
    const minImp = parseInt(params.min_importance, 10);
    if (!Number.isNaN(minImp) && minImp >= 1 && minImp <= 5) {
      query = query.gte("importance", minImp);
    }
  }

  if (params.q) {
    const safe = params.q.replace(/[%_,]/g, "");
    query = query.or(`title.ilike.%${safe}%,summary.ilike.%${safe}%`);
  }

  const { data, error } = await query.limit(200);

  // Counts for each tab
  const [totalRes, pinnedRes, archivedRes, usedRes, newRes] = await Promise.all(
    [
      supabase.from("articles").select("*", { count: "exact", head: true }),
      supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("pinned", true)
        .eq("review_status", "new"),
      supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("review_status", "archived"),
      supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .not("used_in_newsletter_id", "is", null),
      supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("review_status", "new")
        .is("used_in_newsletter_id", null),
    ]
  );

  const counts = {
    all: totalRes.count ?? 0,
    new: newRes.count ?? 0,
    pinned: pinnedRes.count ?? 0,
    used: usedRes.count ?? 0,
    archived: archivedRes.count ?? 0,
  };

  if (error) {
    return (
      <>
        <PageHeader title="후보 기사" description="수집된 기사 목록" />
        <div className="px-8 py-8">
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            데이터를 불러오지 못했습니다: {error.message}
          </div>
        </div>
      </>
    );
  }

  const articles = (data ?? []) as Article[];

  return (
    <>
      <PageHeader
        title="후보 기사"
        description="수집된 기사를 검토하고 상태를 관리합니다. '다음 호 예약'으로 표시한 기사는 다음 초안 생성 시 우선 반영됩니다."
      />
      <div className="px-8 py-6 space-y-4">
        <ArticleList
          articles={articles}
          totalCount={counts.all}
          currentView={view}
          counts={counts}
        />
      </div>
    </>
  );
}
