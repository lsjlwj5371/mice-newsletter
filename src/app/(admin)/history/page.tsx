import { PageHeader, PagePlaceholder } from "@/components/admin/page-header";

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        title="발송 이력"
        description="과거 발송 호, 오픈율·클릭률, 다시 보내기"
      />
      <PagePlaceholder
        phase="Phase 6 — 히스토리 + 다시 보내기"
        description="발송 완료된 호의 HTML 스냅샷, 수신자별 오픈/클릭 기록, 특정 수신자 또는 미오픈자에게 다시 보내기 기능이 들어옵니다."
      />
    </>
  );
}
