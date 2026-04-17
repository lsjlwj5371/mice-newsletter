import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { FORM_KIND_LABELS, type FormRow, type FormResponseRow } from "@/lib/validation/form";
import { signFormToken } from "@/lib/form-token";
import { FormDetailActions } from "@/components/events/form-detail-actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FormDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: formRow, error } = await supabase
    .from("forms")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !formRow) {
    notFound();
  }
  const form = formRow as FormRow;

  const { data: respRows } = await supabase
    .from("form_responses")
    .select("*")
    .eq("form_id", form.id)
    .order("submitted_at", { ascending: false })
    .limit(500);
  const responses = (respRows ?? []) as FormResponseRow[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const shareUrl = `${appUrl}/f/${signFormToken(form.id)}`;

  return (
    <>
      <PageHeader
        title={form.title}
        description={form.description ?? ""}
        actions={
          <Link href={"/events" as never}>
            <Button variant="ghost">← 목록</Button>
          </Link>
        }
      />
      <div className="px-8 py-6 space-y-6 max-w-4xl">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={form.is_open ? "active" : "muted"}>
            {form.is_open ? "응답 받는 중" : "마감됨"}
          </Badge>
          <Badge variant="muted">{FORM_KIND_LABELS[form.kind]}</Badge>
          <span className="text-xs text-muted-foreground">
            응답 {responses.length}건 · 필드 {form.fields.length}개
          </span>
        </div>

        <FormDetailActions
          formId={form.id}
          isOpen={form.is_open}
          shareUrl={shareUrl}
        />

        {/* Responses */}
        <section>
          <h2 className="text-sm font-semibold mb-3">응답</h2>
          {responses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
              아직 응답이 없습니다. 위 공유 URL을 뉴스레터나 메일에 삽입해 보세요.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-background">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                      제출 시각
                    </th>
                    <th className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                      응답자
                    </th>
                    {form.fields.map((f) => (
                      <th
                        key={f.id}
                        className="px-3 py-2 font-medium text-muted-foreground"
                      >
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {formatDateTime(r.submitted_at)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.recipient_email ? (
                          <div>
                            <div className="font-mono">{r.recipient_email}</div>
                            {r.recipient_name && (
                              <div className="text-muted-foreground">
                                {r.recipient_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">익명</span>
                        )}
                      </td>
                      {form.fields.map((f) => {
                        const v = r.answers[f.id];
                        return (
                          <td
                            key={f.id}
                            className="px-3 py-2 max-w-sm whitespace-pre-wrap break-words"
                          >
                            {v === undefined || v === null || v === "" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : Array.isArray(v) ? (
                              v.join(", ")
                            ) : (
                              String(v)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
