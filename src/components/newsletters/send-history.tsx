import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";

interface SendRow {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  status:
    | "queued"
    | "sending"
    | "sent"
    | "failed"
    | "bounced"
    | "skipped";
  is_test: boolean;
  error: string | null;
  gmail_message_id: string | null;
  attempt_count: number;
  queued_at: string;
  sent_at: string | null;
  bounced_at: string | null;
}

const STATUS_LABELS: Record<SendRow["status"], string> = {
  queued: "대기 중",
  sending: "발송 중",
  sent: "발송 완료",
  failed: "실패",
  bounced: "반송",
  skipped: "건너뜀",
};

const STATUS_VARIANT: Record<
  SendRow["status"],
  "active" | "pending" | "muted" | "bounced"
> = {
  queued: "pending",
  sending: "pending",
  sent: "active",
  failed: "bounced",
  bounced: "bounced",
  skipped: "muted",
};

/**
 * Server component: loads the recent send log for this newsletter and
 * renders it inline at the bottom of the send tab. Shows full error
 * messages so admin can diagnose failures without opening the DB.
 */
export async function SendHistory({
  newsletterId,
}: {
  newsletterId: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sends")
    .select(
      "id, recipient_email, recipient_name, status, is_test, error, gmail_message_id, attempt_count, queued_at, sent_at, bounced_at"
    )
    .eq("newsletter_id", newsletterId)
    .order("queued_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        발송 이력을 불러오지 못했습니다: {error.message}
      </div>
    );
  }

  const rows = (data ?? []) as SendRow[];

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground text-center">
        아직 발송 이력이 없습니다. 위에서 테스트 발송을 해 보세요.
      </div>
    );
  }

  // Group counts for a quick summary
  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap text-xs">
        <span className="font-semibold">최근 발송 이력 ({rows.length}건)</span>
        {(Object.keys(counts) as SendRow["status"][]).map((s) => (
          <span key={s} className="text-muted-foreground">
            {STATUS_LABELS[s]} {counts[s]}
          </span>
        ))}
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 sticky top-0">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium text-muted-foreground">
                상태
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                수신자
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                시각
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                에러·메시지
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-t border-border align-top"
              >
                <td className="px-3 py-2">
                  <Badge variant={STATUS_VARIANT[r.status]}>
                    {STATUS_LABELS[r.status]}
                  </Badge>
                  {r.is_test && (
                    <Badge variant="muted" className="ml-1">
                      테스트
                    </Badge>
                  )}
                  {r.attempt_count > 1 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ×{r.attempt_count}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="font-mono">{r.recipient_email}</div>
                  {r.recipient_name && (
                    <div className="text-muted-foreground">
                      {r.recipient_name}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {r.sent_at
                    ? formatDateTime(r.sent_at)
                    : formatDateTime(r.queued_at)}
                </td>
                <td className="px-3 py-2 text-muted-foreground max-w-md">
                  {r.error ? (
                    <details>
                      <summary className="cursor-pointer text-rose-700">
                        {truncate(r.error, 80)}
                      </summary>
                      <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] bg-muted/40 p-2 rounded">
                        {r.error}
                      </pre>
                    </details>
                  ) : r.gmail_message_id ? (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {r.gmail_message_id.slice(0, 24)}…
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
