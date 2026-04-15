import { PageHeader, PagePlaceholder } from "@/components/admin/page-header";

export default function ArticlesPage() {
  return (
    <>
      <PageHeader
        title="후보 기사"
        description="RSS로 수집되고 Claude가 분석한 기사 목록"
      />
      <PagePlaceholder
        phase="Phase 3 — RSS 수집 + Claude 분석"
        description="카테고리(news / mice_in_out / tech / theory)별 후보 기사를 필터링하고, 뉴스레터 작성 시 사용할 항목을 선정합니다."
      />
    </>
  );
}
