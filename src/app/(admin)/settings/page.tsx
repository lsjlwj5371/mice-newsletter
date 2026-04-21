import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { loadTemplateSettings } from "@/lib/template-settings";
import { TemplateEditor } from "./template-editor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const template = await loadTemplateSettings();

  return (
    <>
      <PageHeader
        title="설정"
        description="관리자 계정 · 환경 정보 · 뉴스레터 템플릿"
      />
      <div className="px-8 py-8 space-y-6 max-w-3xl">
        <section>
          <h2 className="text-base font-semibold mb-2">뉴스레터 템플릿</h2>
          <p className="text-xs text-muted-foreground mb-4">
            모든 뉴스레터의 헤더·추천 CTA·푸터 기본값입니다. 저장하면 아직
            발송되지 않은 초안에도 자동으로 반영됩니다 (각 호의 호 번호는
            그대로 유지). 이미 발송 완료된 호는 보관 목적으로 그 시점의
            템플릿을 유지합니다.
          </p>
          <TemplateEditor
            initial={{
              header: {
                wordmark: template.header.wordmark,
                tagline: template.header.tagline,
                industryTag: template.header.industryTag,
                description: template.header.description,
                wordmarkFontSize: template.header.wordmarkFontSize ?? null,
                wordmarkColor: template.header.wordmarkColor ?? null,
                wordmarkFontWeight: template.header.wordmarkFontWeight ?? null,
                wordmarkLetterSpacing:
                  template.header.wordmarkLetterSpacing ?? null,
                wordmarkLogoUrl: template.header.wordmarkLogoUrl ?? null,
                wordmarkLogoHeight: template.header.wordmarkLogoHeight ?? null,
              },
              referralCta: template.referralCta,
              footer: {
                brandName: template.footer.brandName,
                brandTagline: template.footer.brandTagline ?? "",
                links: template.footer.links,
                unsubscribeHref: template.footer.unsubscribeHref,
                logoSrc: template.footer.logoSrc ?? null,
                logoWidth: template.footer.logoWidth ?? null,
              },
            }}
          />
        </section>

        <section className="rounded-xl border border-border bg-background p-6">
          <h2 className="text-sm font-semibold mb-3">현재 로그인 계정</h2>
          <dl className="text-sm space-y-2">
            <div className="flex">
              <dt className="w-32 text-muted-foreground">이메일</dt>
              <dd className="font-mono">{user?.email}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-muted-foreground">User ID</dt>
              <dd className="font-mono text-xs">{user?.id}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-background p-6">
          <h2 className="text-sm font-semibold mb-3">시스템 정보</h2>
          <dl className="text-sm space-y-2">
            <div className="flex">
              <dt className="w-32 text-muted-foreground">앱 버전</dt>
              <dd>0.1.0 — Phase 1</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-muted-foreground">발송 계정</dt>
              <dd className="font-mono">
                {process.env.GOOGLE_SENDER_EMAIL ?? "(미설정)"}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-muted-foreground">앱 URL</dt>
              <dd className="font-mono text-xs">
                {process.env.NEXT_PUBLIC_APP_URL ?? "(미설정)"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-background p-6">
          <h2 className="text-sm font-semibold mb-3">관리자 추가</h2>
          <p className="text-sm text-muted-foreground">
            새 관리자를 추가하려면 Vercel/로컬 환경변수의{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
              ADMIN_ALLOWLIST
            </code>{" "}
            에 이메일을 추가하고 재배포하세요. (Phase 8에서 관리자 화면 내
            추가 UI 제공 예정)
          </p>
        </section>
      </div>
    </>
  );
}
