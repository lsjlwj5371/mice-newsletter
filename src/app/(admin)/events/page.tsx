import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  FORM_KIND_LABELS,
  type FormRow,
} from "@/lib/validation/form";
import { NewFormButton } from "@/components/events/new-form-button";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <>
        <PageHeader title="이벤트 · 의견 수집" />
        <div className="px-8 py-8">
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            데이터 조회 실패: {error.message}
          </div>
        </div>
      </>
    );
  }

  const forms = (data ?? []) as FormRow[];

  // Fetch response counts per form
  const counts = new Map<string, number>();
  await Promise.all(
    forms.map(async (f) => {
      const { count } = await supabase
        .from("form_responses")
        .select("*", { count: "exact", head: true })
        .eq("form_id", f.id);
      counts.set(f.id, count ?? 0);
    })
  );

  return (
    <>
      <PageHeader
        title="이벤트 · 의견 수집"
        description="뉴스레터에 삽입할 설문·이벤트 신청·피드백 폼을 만들고 응답을 모아볼 수 있습니다."
        actions={<NewFormButton />}
      />
      <div className="px-8 py-6">
        {forms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 만들어진 폼이 없습니다.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              우측 상단의 <span className="font-medium">+ 새 폼 만들기</span>{" "}
              버튼으로 시작하세요.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {forms.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant={f.is_open ? "active" : "muted"}>
                        {f.is_open ? "응답 받는 중" : "마감됨"}
                      </Badge>
                      <Badge variant="muted">
                        {FORM_KIND_LABELS[f.kind]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        필드 {f.fields.length}개
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · 응답 {counts.get(f.id) ?? 0}건
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {formatDate(f.created_at)}
                      </span>
                    </div>
                    <Link
                      href={`/events/${f.id}` as never}
                      className="block group"
                    >
                      <h3 className="text-base font-semibold leading-snug group-hover:underline">
                        {f.title}
                      </h3>
                      {f.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                          {f.description}
                        </p>
                      )}
                    </Link>
                  </div>
                  <Link href={`/events/${f.id}` as never}>
                    <Button size="sm" variant="outline">
                      관리 · 응답 보기
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
