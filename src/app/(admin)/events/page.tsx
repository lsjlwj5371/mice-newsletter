import { PageHeader, PagePlaceholder } from "@/components/admin/page-header";

export default function EventsPage() {
  return (
    <>
      <PageHeader
        title="이벤트 · 의견 수집"
        description="뉴스레터 CTA로 들어온 응답 모아보기"
      />
      <PagePlaceholder
        phase="Phase 7 — 이벤트 + 의견 수집"
        description="뉴스레터 안 CTA 버튼이 토큰 폼으로 연결되며, 여기서 응답을 집계·필터링·내보내기할 수 있습니다."
      />
    </>
  );
}
