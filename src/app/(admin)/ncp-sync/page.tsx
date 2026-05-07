import { PageHeader } from "@/components/admin/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { NcpSyncClient, type NcpPendingRow, type NcpView } from "./ncp-sync-client";

export const dynamic = "force-dynamic";

interface SearchParams {
  adds?: string;
  removes?: string;
}

interface RawRow {
  id: string;
  email: string;
  name: string | null;
  organization: string | null;
  referrer_email: string | null;
  source_kind: string;
  requested_at: string;
  completed_at: string | null;
}

export default async function NcpSyncPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const params = (await searchParams) ?? {};
  const addView: NcpView = params.adds === "done" ? "done" : "pending";
  const removeView: NcpView = params.removes === "done" ? "done" : "pending";

  // ─── NCP 추가 큐 (대기 or 완료) ───
  const addsBase = supabase
    .from("ncp_sync_requests")
    .select(
      "id,email,name,organization,referrer_email,source_kind,requested_at,completed_at"
    )
    .eq("request_type", "add");
  const addsQuery =
    addView === "pending"
      ? addsBase
          .is("completed_at", null)
          .order("requested_at", { ascending: false })
      : addsBase
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false });
  const { data: adds } = await addsQuery.limit(500);

  // ─── NCP 제거 큐 (대기 or 완료) ───
  const removesBase = supabase
    .from("ncp_sync_requests")
    .select(
      "id,email,name,organization,referrer_email,source_kind,requested_at,completed_at"
    )
    .eq("request_type", "remove");
  const removesQuery =
    removeView === "pending"
      ? removesBase
          .is("completed_at", null)
          .order("requested_at", { ascending: false })
      : removesBase
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false });
  const { data: removes } = await removesQuery.limit(500);

  const addRows: NcpPendingRow[] = ((adds ?? []) as RawRow[]).map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name ?? null,
    organization: r.organization ?? null,
    position: null,
    source: r.source_kind,
    at: r.requested_at,
    completedAt: r.completed_at ?? null,
    referrerEmail: r.referrer_email ?? null,
  }));

  const removeRows: NcpPendingRow[] = ((removes ?? []) as RawRow[]).map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name ?? null,
    organization: r.organization ?? null,
    position: null,
    source: r.source_kind,
    at: r.requested_at,
    completedAt: r.completed_at ?? null,
    referrerEmail: null,
  }));

  return (
    <>
      <PageHeader
        title="NCP 동기화"
        description="뉴스레터의 추천/거부 링크로 들어온 외부 사용자의 신청을 모아 보여주는 큐입니다. 본 콘솔의 수신자 리스트와 별도로 관리되며, 관리자가 NCP 주소록에 수기로 반영한 뒤 '처리 완료' 로 마킹하세요."
      />
      <div className="px-8 py-6">
        <NcpSyncClient
          addRows={addRows}
          removeRows={removeRows}
          addView={addView}
          removeView={removeView}
        />
      </div>
    </>
  );
}
