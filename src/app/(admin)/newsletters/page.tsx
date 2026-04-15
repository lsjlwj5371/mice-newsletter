import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { NewsletterList } from "@/components/newsletters/newsletter-list";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import type { NewsletterRow } from "@/types/newsletter";

export const dynamic = "force-dynamic";

export default async function NewslettersPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("newsletters")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <>
        <PageHeader title="뉴스레터" description="작성·미리보기·발송" />
        <div className="px-8 py-8">
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            데이터를 불러오지 못했습니다: {error.message}
          </div>
        </div>
      </>
    );
  }

  const newsletters = (data ?? []) as NewsletterRow[];

  return (
    <>
      <PageHeader
        title="뉴스레터"
        description="새 호 작성, 미리보기, 자연어 편집, 발송 관리"
        actions={
          <Link href={"/newsletters/new" as never}>
            <Button>+ 새 호 만들기</Button>
          </Link>
        }
      />
      <div className="px-8 py-6">
        <NewsletterList newsletters={newsletters} />
      </div>
    </>
  );
}
