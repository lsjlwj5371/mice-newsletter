import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  NEWSLETTER_STATUS_LABELS,
  type NewsletterStatus,
} from "@/types/newsletter";

export const dynamic = "force-dynamic";

interface NewsletterRow {
  id: string;
  issue_label: string;
  subject: string;
  status: NewsletterStatus;
  sent_at: string | null;
  created_at: string;
}

interface StatsRow {
  newsletter_id: string;
  sent: number;
  failed: number;
  bounced: number;
  skipped: number;
  queued: number;
  opened: number;
  clicked: number;
  total: number;
}

const STATUS_BADGE: Record<
  NewsletterStatus,
  "active" | "pending" | "muted" | "bounced" | "default"
> = {
  draft: "pending",
  review: "pending",
  scheduled: "pending",
  sent: "active",
  archived: "muted",
};

export default async function HistoryPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  // Get newsletters that have any sends (i.e. were at least attempted)
  const { data: newsletters, error: nlErr } = await supabase
    .from("newsletters")
    .select("id, issue_label, subject, status, sent_at, created_at")
    .in("status", ["scheduled", "sent", "archived"])
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (nlErr) {
    return (
      <>
        <PageHeader title="발송 이력" description="과거 발송 + 성과 지표" />
        <div className="px-8 py-8">
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            데이터 조회 실패: {nlErr.message}
          </div>
        </div>
      </>
    );
  }

  const rows = (newsletters ?? []) as NewsletterRow[];

  // Fetch stats for each newsletter in parallel (small N)
  const statsMap = new Map<string, StatsRow>();
  await Promise.all(
    rows.map(async (nl) => {
      const { data: sendRows } = await supabase
        .from("sends")
        .select("status, opened_at, clicked_at, is_test")
        .eq("newsletter_id", nl.id)
        .eq("is_test", false);

      const stats: StatsRow = {
        newsletter_id: nl.id,
        sent: 0,
        failed: 0,
        bounced: 0,
        skipped: 0,
        queued: 0,
        opened: 0,
        clicked: 0,
        total: 0,
      };
      for (const r of sendRows ?? []) {
        stats.total++;
        if (r.status === "sent") stats.sent++;
        else if (r.status === "failed") stats.failed++;
        else if (r.status === "bounced") stats.bounced++;
        else if (r.status === "skipped") stats.skipped++;
        else if (r.status === "queued" || r.status === "sending")
          stats.queued++;
        if (r.opened_at) stats.opened++;
        if (r.clicked_at) stats.clicked++;
      }
      statsMap.set(nl.id, stats);
    })
  );

  return (
    <>
      <PageHeader
        title="발송 이력"
        description="발송된 호의 오픈율·클릭률과 재발송 기능을 제공합니다."
      />
      <div className="px-8 py-6">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 발송된 호가 없습니다.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <Link
                href={"/newsletters" as never}
                className="underline"
              >
                뉴스레터 메뉴
              </Link>
              에서 초안을 만들고 발송 탭에서 발송해 보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((nl) => {
              const s = statsMap.get(nl.id)!;
              const openRate =
                s.sent > 0 ? Math.round((s.opened / s.sent) * 100) : 0;
              const clickRate =
                s.sent > 0 ? Math.round((s.clicked / s.sent) * 100) : 0;
              return (
                <div
                  key={nl.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variant={STATUS_BADGE[nl.status]}>
                          {NEWSLETTER_STATUS_LABELS[nl.status]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {nl.sent_at
                            ? `발송: ${formatDateTime(nl.sent_at)}`
                            : `작성: ${formatDateTime(nl.created_at)}`}
                        </span>
                      </div>
                      <Link
                        href={`/newsletters/${nl.id}` as never}
                        className="block group"
                      >
                        <h3 className="text-base font-semibold leading-snug group-hover:underline">
                          {nl.issue_label}
                        </h3>
                        {nl.subject && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                            {nl.subject}
                          </p>
                        )}
                      </Link>
                    </div>
                    <Link href={`/newsletters/${nl.id}` as never}>
                      <Button size="sm" variant="outline">
                        자세히 / 재발송
                      </Button>
                    </Link>
                  </div>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <Stat label="수신자" value={s.total} />
                    <Stat label="발송 완료" value={s.sent} variant="success" />
                    <Stat
                      label="오픈율"
                      value={`${openRate}%`}
                      hint={`${s.opened}명`}
                    />
                    <Stat
                      label="클릭율"
                      value={`${clickRate}%`}
                      hint={`${s.clicked}명`}
                    />
                    <Stat
                      label="실패"
                      value={s.failed}
                      variant={s.failed > 0 ? "error" : "default"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  variant = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  variant?: "default" | "success" | "error";
}) {
  const color =
    variant === "success"
      ? "text-emerald-700"
      : variant === "error"
      ? "text-rose-700"
      : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
