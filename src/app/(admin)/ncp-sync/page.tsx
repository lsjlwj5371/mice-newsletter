import { PageHeader } from "@/components/admin/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { NcpSyncClient, type NcpPendingRow, type NcpView } from "./ncp-sync-client";

export const dynamic = "force-dynamic";

interface SearchParams {
  adds?: string;
  removes?: string;
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

  // ─── NCP 추가 큐 (pending or done) ───
  // status='pending' = /refer 또는 /r/[token] 으로 막 가입한 검토 대기 수신자
  // status='active'  = 관리자가 직접 /recipients 에서 추가했거나 이미 승격된 수신자
  // 두 상태 모두 NCP 추가 큐 후보. ncp_added_at 으로 대기/완료 구분.
  const addsBase = supabase
    .from("recipients")
    .select(
      "id,email,name,organization,position,source,status,created_at,referred_by,ncp_added_at"
    )
    .in("status", ["active", "pending"]);
  const addsQuery =
    addView === "pending"
      ? addsBase
          .is("ncp_added_at", null)
          .order("created_at", { ascending: false })
      : addsBase
          .not("ncp_added_at", "is", null)
          .order("ncp_added_at", { ascending: false });
  const { data: adds } = await addsQuery.limit(500);

  // ─── NCP 제거 큐 (pending or done) ───
  const removesBase = supabase
    .from("recipients")
    .select(
      "id,email,name,organization,status,unsubscribed_at,created_at,ncp_removed_at"
    )
    .in("status", ["unsubscribed", "bounced"]);
  const removesQuery =
    removeView === "pending"
      ? removesBase
          .is("ncp_removed_at", null)
          .order("unsubscribed_at", { ascending: false, nullsFirst: false })
      : removesBase
          .not("ncp_removed_at", "is", null)
          .order("ncp_removed_at", { ascending: false });
  const { data: removes } = await removesQuery.limit(500);

  // 추천인 이메일을 함께 보여주기 위해 referrer lookup
  const referrerIds = (adds ?? [])
    .map((r) => r.referred_by)
    .filter((v): v is string => !!v);
  let referrerMap: Record<string, string> = {};
  if (referrerIds.length > 0) {
    const { data: refs } = await supabase
      .from("recipients")
      .select("id,email")
      .in("id", referrerIds);
    referrerMap = Object.fromEntries(
      (refs ?? []).map((r) => [r.id, r.email])
    );
  }

  const addRows: NcpPendingRow[] = (adds ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name ?? null,
    organization: r.organization ?? null,
    position: r.position ?? null,
    source: r.source,
    at: r.created_at,
    completedAt: r.ncp_added_at ?? null,
    referrerEmail: r.referred_by ? referrerMap[r.referred_by] ?? null : null,
  }));

  const removeRows: NcpPendingRow[] = (removes ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name ?? null,
    organization: r.organization ?? null,
    position: null,
    source: r.status,
    at: r.unsubscribed_at ?? r.created_at,
    completedAt: r.ncp_removed_at ?? null,
    referrerEmail: null,
  }));

  return (
    <>
      <PageHeader
        title="NCP 동기화"
        description="수신자 추천·수신 거부 요청을 모아서 네이버 Cloud 주소록에 수동 반영하는 작업용 큐입니다. 완료된 항목은 '완료됨' 토글로 확인할 수 있습니다."
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
