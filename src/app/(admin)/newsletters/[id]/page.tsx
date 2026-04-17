import { notFound } from "next/navigation";
import Link from "next/link";
import { render } from "@react-email/render";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { DraftEditor } from "@/components/newsletters/draft-editor";
import Newsletter from "@/emails/Newsletter";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { newsletterContentSchema } from "@/lib/validation/newsletter-content";
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

  // Detect legacy (schema v1) content that does not have the new blocks[] shape.
  // Those drafts were created before the block system existed and cannot be
  // rendered by the new template. Show a friendly explainer instead of crashing.
  const parsed = newsletterContentSchema.safeParse(newsletter.content_json);
  if (!parsed.success) {
    return (
      <>
        <PageHeader
          title={newsletter.issue_label}
          description={newsletter.subject || "제목 없음"}
        />
        <div className="px-8 py-6 space-y-4 max-w-2xl">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
            <p className="font-medium">
              ⚠️ 이 호는 예전 스키마(v1)로 저장돼 새 템플릿에서 렌더링할 수 없습니다.
            </p>
            <p>
              블록 기반 스키마(v2)로 구조가 바뀌었기 때문에, 이 호를 삭제한 뒤 다시
              "새 호 만들기"로 생성하시면 됩니다. 이미 저장된 콘텐츠는 의미가 같으니
              다시 생성해도 결과물은 비슷합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={"/newsletters" as never}>
              <Button variant="outline">목록으로</Button>
            </Link>
            <Link href={"/newsletters/new" as never}>
              <Button>새 호 만들기</Button>
            </Link>
          </div>

          <details className="rounded-md border border-border bg-background px-4 py-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              에러 내용 (개발자용)
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto rounded bg-muted/40 p-3 text-[10px] font-mono whitespace-pre-wrap">
              {parsed.error.issues
                .slice(0, 8)
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("\n")}
            </pre>
          </details>
        </div>
      </>
    );
  }

  const html = await render(
    <Newsletter content={parsed.data} appUrl={appUrl} />,
    { pretty: false }
  );

  // Collect all referenced article IDs across all blocks, fetch their
  // titles/urls so the admin can see what Claude picked from.
  const allRefIds = Array.from(
    new Set(
      parsed.data.blocks.flatMap((b) => b.referencedArticleIds ?? [])
    )
  );
  const articleMetaMap = new Map<
    string,
    { title: string; url: string; source: string | null; category: string }
  >();
  if (allRefIds.length > 0) {
    const { data: artRows } = await supabase
      .from("articles")
      .select("id, title, url, source, category")
      .in("id", allRefIds);
    for (const a of artRows ?? []) {
      articleMetaMap.set(a.id as string, {
        title: a.title as string,
        url: a.url as string,
        source: (a.source as string | null) ?? null,
        category: a.category as string,
      });
    }
  }
  const articleMeta = Object.fromEntries(articleMetaMap);

  const { count: activeRecipientCount } = await supabase
    .from("recipients")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  return (
    <>
      <PageHeader
        title={newsletter.issue_label}
        description={newsletter.subject || "제목 없음"}
      />
      <DraftEditor
        newsletter={newsletter}
        initialHtml={html}
        articleMeta={articleMeta}
        activeRecipientCount={activeRecipientCount ?? 0}
      />
    </>
  );
}
