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
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("articles")
    .select("*")
    .order("collected_at", { ascending: false });

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

  const { count: totalCount } = await supabase
    .from("articles")
    .select("*", { count: "exact", head: true });

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
        description="RSS로 수집되고 Claude가 분석한 기사 목록. 카테고리·중요도·검색으로 필터링하고 클릭해서 상세 내용을 확인할 수 있습니다."
      />
      <div className="px-8 py-6 space-y-4">
        <ArticleList articles={articles} totalCount={totalCount ?? 0} />
      </div>
    </>
  );
}
