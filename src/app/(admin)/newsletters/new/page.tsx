import { PageHeader } from "@/components/admin/page-header";
import { NewDraftForm } from "@/components/newsletters/new-draft-form";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Compute the next issue number suggestion: count of all non-archived
 * newsletters (draft / review / scheduled / sent) + 1. Archived issues
 * are skipped because admins typically reset them after a mistake and
 * wouldn't expect them to occupy a slot in the public sequence.
 *
 * Admin can still override the issue label freely — this is a default,
 * not a hard constraint, so special editions (예: "창간호", "특별호")
 * work by just typing the desired label.
 */
async function computeNextIssueNumber(): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("newsletters")
      .select("*", { count: "exact", head: true })
      .neq("status", "archived");
    if (error) return 1;
    return (count ?? 0) + 1;
  } catch {
    return 1;
  }
}

export default async function NewNewsletterPage() {
  await requireAdmin();
  const nextIssueNumber = await computeNextIssueNumber();

  return (
    <>
      <PageHeader
        title="새 호 만들기"
        description="후보 기사 + 사전 레퍼런스를 바탕으로 Claude가 11개 섹션 초안을 자동 작성합니다."
      />
      <div className="px-8 py-6">
        <NewDraftForm defaultIssueNumber={nextIssueNumber} />
      </div>
    </>
  );
}
