import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <PageHeader
        title="설정"
        description="관리자 계정 · 환경 정보"
      />
      <div className="px-8 py-8 space-y-6 max-w-3xl">
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
