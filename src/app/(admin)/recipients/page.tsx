import { PageHeader, PagePlaceholder } from "@/components/admin/page-header";

export default function RecipientsPage() {
  return (
    <>
      <PageHeader
        title="수신자"
        description="구독자 관리, CSV 임포트, 추천·해지 토큰"
      />
      <PagePlaceholder
        phase="Phase 2 — 수신자 & 구독 관리"
        description="수신자 CRUD, 상태 필터, CSV 일괄 등록, 추천 이중 옵트인, 해지 토큰 관리가 들어옵니다."
      />
    </>
  );
}
