import { PageHeader, PagePlaceholder } from "@/components/admin/page-header";

export default function RssPage() {
  return (
    <>
      <PageHeader
        title="RSS 피드"
        description="수집할 RSS 소스 등록 및 카테고리 관리"
      />
      <PagePlaceholder
        phase="Phase 3 — RSS 수집 + Claude 분석"
        description="피드 URL을 등록하고 카테고리·활성/비활성을 설정합니다. 매일 새벽 자동 수집되며, weekly briefing이 사용 중인 피드를 초기 시드로 활용합니다."
      />
    </>
  );
}
