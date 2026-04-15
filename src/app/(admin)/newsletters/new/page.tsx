import { PageHeader } from "@/components/admin/page-header";
import { NewDraftForm } from "@/components/newsletters/new-draft-form";
import { requireAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function NewNewsletterPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="새 호 만들기"
        description="후보 기사 + 사전 레퍼런스를 바탕으로 Claude가 11개 섹션 초안을 자동 작성합니다."
      />
      <div className="px-8 py-6">
        <NewDraftForm />
      </div>
    </>
  );
}
