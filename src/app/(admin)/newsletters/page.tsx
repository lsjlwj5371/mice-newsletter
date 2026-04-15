import { PageHeader, PagePlaceholder } from "@/components/admin/page-header";

export default function NewslettersPage() {
  return (
    <>
      <PageHeader
        title="뉴스레터"
        description="새 호 작성, 미리보기, 자연어 편집, 발송 관리"
      />
      <PagePlaceholder
        phase="Phase 4 — 뉴스레터 스튜디오"
        description="후보 기사 선정 → Claude 초안 → 미리보기 → 자연어 편집 → 테스트 발송 → 예약/즉시 발송까지 한 화면에서 처리합니다."
      />
    </>
  );
}
