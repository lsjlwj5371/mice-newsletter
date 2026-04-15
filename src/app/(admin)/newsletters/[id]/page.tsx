import { notFound } from "next/navigation";
import { render } from "@react-email/render";
import { PageHeader } from "@/components/admin/page-header";
import { DraftEditor } from "@/components/newsletters/draft-editor";
import Newsletter from "@/emails/Newsletter";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import type { NewsletterRow } from "@/types/newsletter";

export const dynamic = "force-dynamic";

export default async function NewsletterDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("newsletters")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const newsletter = data as NewsletterRow;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Render the email HTML for the iframe
  const html = await render(
    <Newsletter content={newsletter.content_json} appUrl={appUrl} />,
    { pretty: false }
  );

  return (
    <>
      <PageHeader
        title={newsletter.issue_label}
        description={newsletter.subject || "제목 없음"}
      />
      <DraftEditor newsletter={newsletter} initialHtml={html} />
    </>
  );
}
