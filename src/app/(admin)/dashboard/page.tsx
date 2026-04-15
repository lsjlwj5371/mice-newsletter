import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <PageHeader
        title="대시보드"
        description="MICE Newsletter 운영 현황 한눈에 보기"
      />
      <div className="px-8 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="활성 수신자" value="—" hint="Phase 2에서 연결" />
        <Card label="이번 달 후보 기사" value="—" hint="Phase 3에서 연결" />
        <Card label="최근 발송 호" value="—" hint="Phase 5에서 연결" />
        <Card label="평균 오픈율" value="—" hint="Phase 6에서 연결" />
      </div>

      <div className="px-8 pb-10">
        <div className="rounded-xl border border-border bg-background p-6">
          <h2 className="text-base font-semibold mb-1">
            안녕하세요, {user?.email} 님 👋
          </h2>
          <p className="text-sm text-muted-foreground">
            현재 <span className="font-medium">Phase 1 — 인증 + 섀시</span> 가
            완료된 상태입니다. 좌측 메뉴는 비어있는 상태이고, 다음 단계부터
            실제 기능이 채워집니다.
          </p>
        </div>
      </div>
    </>
  );
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
