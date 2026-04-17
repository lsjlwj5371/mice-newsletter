import { PageHeader } from "@/components/admin/page-header";
import { RssToolbar } from "@/components/rss/rss-toolbar";
import { RssFeedTable } from "@/components/rss/rss-feed-table";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import type { RssFeed } from "@/lib/validation/rss";

export const dynamic = "force-dynamic";

export default async function RssPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  // Note: we used to order by rss_feeds.category but that column was dropped
  // in migration 0007 in favor of categories (array). Array columns aren't
  // directly sortable in a meaningful way, so sort by name only.
  const { data, error } = await supabase
    .from("rss_feeds")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return (
      <>
        <PageHeader title="RSS 피드" description="RSS 소스 등록 및 관리" />
        <div className="px-8 py-8">
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            데이터를 불러오지 못했습니다: {error.message}
          </div>
        </div>
      </>
    );
  }

  const feeds = (data ?? []) as RssFeed[];

  return (
    <>
      <PageHeader
        title="RSS 피드"
        description="수집할 RSS 피드를 카테고리별로 등록하고 활성/비활성을 관리합니다. 매일 자동 수집되며, 수동 실행으로 즉시 테스트할 수도 있습니다."
      />
      <div className="px-8 py-6 space-y-4">
        <RssToolbar feedCount={feeds.length} />
        <RssFeedTable feeds={feeds} />
      </div>
    </>
  );
}
