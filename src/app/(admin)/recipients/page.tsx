import { PageHeader } from "@/components/admin/page-header";
import { RecipientToolbar } from "@/components/recipients/recipient-toolbar";
import { RecipientTable } from "@/components/recipients/recipient-table";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  RECIPIENT_STATUSES,
  type Recipient,
} from "@/lib/validation/recipient";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
}

export default async function RecipientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const supabase = createAdminClient();

  // Build the query
  let query = supabase
    .from("recipients")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  const explicitStatus =
    params.status &&
    (RECIPIENT_STATUSES as readonly string[]).includes(params.status)
      ? params.status
      : null;

  if (explicitStatus) {
    query = query.eq("status", explicitStatus);
  } else {
    // 자기-구독 가입자 (status='pending') 는 NCP 동기화 페이지에서만 노출되고
    // 메인 수신자 리스트에는 자동으로 들어오지 않도록 기본 필터에서 제외.
    // ?status=pending 으로 명시 필터링하면 여전히 조회 가능.
    query = query.neq("status", "pending");
  }

  if (params.q) {
    const safe = params.q.replace(/[%_,]/g, "");
    query = query.or(
      `email.ilike.%${safe}%,name.ilike.%${safe}%,organization.ilike.%${safe}%`
    );
  }

  const { data: filtered, error } = await query.limit(500);

  // 메인 totalCount 도 pending 을 제외해야 "총 N명" 이 리스트와 일치.
  const { count: totalCount } = await supabase
    .from("recipients")
    .select("*", { count: "exact", head: true })
    .neq("status", "pending");

  if (error) {
    return (
      <>
        <PageHeader title="수신자" description="구독자 관리" />
        <div className="px-8 py-8">
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            데이터를 불러오지 못했습니다: {error.message}
          </div>
        </div>
      </>
    );
  }

  const recipients = (filtered ?? []) as Recipient[];

  return (
    <>
      <PageHeader
        title="수신자"
        description="뉴스레터 구독자 관리. 이메일·이름·조직으로 검색하고 상태별로 필터링할 수 있습니다."
      />
      <div className="px-8 py-6 space-y-4">
        <RecipientToolbar
          totalCount={totalCount ?? 0}
          filteredCount={recipients.length}
        />
        <RecipientTable recipients={recipients} />
      </div>
    </>
  );
}
