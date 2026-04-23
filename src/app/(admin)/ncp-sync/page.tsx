import { PageHeader } from "@/components/admin/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { NcpSyncClient, type NcpPendingRow } from "./ncp-sync-client";

export const dynamic = "force-dynamic";

export default async function NcpSyncPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  // NCP 추가 대기 — 아직 NCP 주소록에 올리지 않은 활성 수신자
  const { data: adds } = await supabase
    .from("recipients")
    .select(
      "id,email,name,organization,position,source,created_at,referred_by"
    )
    .eq("status", "active")
    .is("ncp_added_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  // NCP 제거 대기 — 수신 거부 / 바운스되었지만 아직 NCP 주소록에서 제거 안 됨
  const { data: removes } = await supabase
    .from("recipients")
    .select(
      "id,email,name,organization,status,unsubscribed_at,created_at"
    )
    .in("status", ["unsubscribed", "bounced"])
    .is("ncp_removed_at", null)
    .order("unsubscribed_at", { ascending: false, nullsFirst: false })
    .limit(500);

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
    referrerEmail: r.referred_by ? referrerMap[r.referred_by] ?? null : null,
  }));

  const removeRows: NcpPendingRow[] = (removes ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name ?? null,
    organization: r.organization ?? null,
    position: null,
    source: r.status, // 'unsubscribed' | 'bounced'
    at: r.unsubscribed_at ?? r.created_at,
    referrerEmail: null,
  }));

  return (
    <>
      <PageHeader
        title="NCP 동기화"
        description="수신자 추천·수신 거부 요청을 모아서 네이버 Cloud 주소록에 수동 반영하는 작업용 큐입니다. 처리 완료 후 체크하면 대기 목록에서 사라집니다."
      />
      <div className="px-8 py-6">
        <NcpSyncClient addRows={addRows} removeRows={removeRows} />
      </div>
    </>
  );
}
