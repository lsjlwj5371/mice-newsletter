import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type AuditRow = {
  id: number;
  admin_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  at: string;
};

type AdminRow = { id: string; email: string };

const DAY_OPTIONS = [1, 7, 30, 90] as const;

function parseDays(v: string | undefined): number {
  const n = Number(v);
  if (DAY_OPTIONS.includes(n as (typeof DAY_OPTIONS)[number])) return n;
  return 7;
}

function parseOffset(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    action?: string;
    entity?: string;
    admin?: string;
    offset?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const days = parseDays(sp.days);
  const offset = parseOffset(sp.offset);
  const actionFilter = (sp.action ?? "").trim();
  const entityFilter = (sp.entity ?? "").trim();
  const adminFilter = (sp.admin ?? "").trim();

  const supabase = createAdminClient();
  const sinceIso = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();

  let query = supabase
    .from("audit_logs")
    .select("id, admin_id, action, entity, entity_id, metadata, at", {
      count: "exact",
    })
    .gte("at", sinceIso)
    .order("at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (actionFilter) {
    query = query.ilike("action", `%${actionFilter}%`);
  }
  if (entityFilter) {
    query = query.eq("entity", entityFilter);
  }

  // If an admin email filter is given, resolve to admin_id first.
  let adminIdFilter: string | null = null;
  if (adminFilter) {
    const { data: match } = await supabase
      .from("admins")
      .select("id")
      .ilike("email", `%${adminFilter}%`)
      .limit(1)
      .maybeSingle();
    adminIdFilter = match?.id ?? null;
    if (adminIdFilter) {
      query = query.eq("admin_id", adminIdFilter);
    } else {
      // Admin not found — return empty set without firing a query that would
      // bind an invalid UUID.
      query = query.eq("admin_id", "00000000-0000-0000-0000-000000000000");
    }
  }

  const { data: rows, count, error } = await query;

  // Resolve admin emails in one shot
  const adminIds = Array.from(
    new Set((rows ?? []).map((r) => r.admin_id).filter((v): v is string => !!v))
  );
  const emailById = new Map<string, string>();
  if (adminIds.length > 0) {
    const { data: adminRows } = await supabase
      .from("admins")
      .select("id, email")
      .in("id", adminIds);
    for (const a of (adminRows ?? []) as AdminRow[]) {
      emailById.set(a.id, a.email);
    }
  }

  const total = count ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  function buildHref(patch: Record<string, string | number>) {
    const params = new URLSearchParams();
    params.set("days", String(days));
    if (actionFilter) params.set("action", actionFilter);
    if (entityFilter) params.set("entity", entityFilter);
    if (adminFilter) params.set("admin", adminFilter);
    if (offset) params.set("offset", String(offset));
    for (const [k, v] of Object.entries(patch)) {
      params.set(k, String(v));
    }
    return `/audit?${params.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="감사 로그"
        description="관리자 행동 기록(폼 작성·발송·구독·해지 등)"
      />
      <div className="px-8 py-6 space-y-4">
        <form className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs font-semibold mb-1">기간</label>
            <select
              name="days"
              defaultValue={String(days)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  최근 {d}일
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              action 포함 문자열
            </label>
            <input
              name="action"
              defaultValue={actionFilter}
              placeholder="예: newsletter."
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">entity</label>
            <input
              name="entity"
              defaultValue={entityFilter}
              placeholder="예: newsletter"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              관리자 이메일
            </label>
            <input
              name="admin"
              defaultValue={adminFilter}
              placeholder="예: groundk21"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="h-9 px-4 rounded-md bg-foreground text-background text-sm font-medium"
          >
            필터 적용
          </button>
          <Link
            href="/audit"
            className="h-9 px-3 inline-flex items-center text-xs text-muted-foreground underline"
          >
            초기화
          </Link>
        </form>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            조회 실패: {error.message}
          </div>
        ) : (rows ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center text-sm text-muted-foreground">
            이 조건에 해당하는 감사 로그가 없습니다.
          </div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              총 {total.toLocaleString()}건 중{" "}
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)}
            </div>
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 w-40">시각</th>
                    <th className="text-left px-3 py-2 w-48">관리자</th>
                    <th className="text-left px-3 py-2">action</th>
                    <th className="text-left px-3 py-2 w-40">entity</th>
                    <th className="text-left px-3 py-2">metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as AuditRow[]).map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                        {formatDateTime(r.at)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.admin_id
                          ? emailById.get(r.admin_id) ?? (
                              <span className="font-mono text-muted-foreground">
                                {r.admin_id.slice(0, 8)}…
                              </span>
                            )
                          : (
                              <span className="text-muted-foreground italic">
                                시스템/공개
                              </span>
                            )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={badgeVariantFor(r.action)}>
                          {r.action}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.entity ? (
                          <>
                            <div>{r.entity}</div>
                            {r.entity_id && (
                              <div className="font-mono text-muted-foreground">
                                {r.entity_id.slice(0, 8)}…
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.metadata ? (
                          <details>
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              {summarize(r.metadata)}
                            </summary>
                            <pre className="mt-2 whitespace-pre-wrap break-all rounded-md bg-muted/40 p-2 text-[11px] leading-snug">
                              {JSON.stringify(r.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 justify-end">
              <Link
                href={
                  hasPrev
                    ? (buildHref({
                        offset: Math.max(0, offset - PAGE_SIZE),
                      }) as never)
                    : ("/audit" as never)
                }
                aria-disabled={!hasPrev}
                className={`h-9 px-3 inline-flex items-center rounded-md border border-border text-sm ${
                  hasPrev
                    ? "hover:bg-muted"
                    : "opacity-40 pointer-events-none"
                }`}
              >
                ← 이전
              </Link>
              <Link
                href={
                  hasNext
                    ? (buildHref({ offset: offset + PAGE_SIZE }) as never)
                    : ("/audit" as never)
                }
                aria-disabled={!hasNext}
                className={`h-9 px-3 inline-flex items-center rounded-md border border-border text-sm ${
                  hasNext
                    ? "hover:bg-muted"
                    : "opacity-40 pointer-events-none"
                }`}
              >
                다음 →
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function summarize(md: Record<string, unknown>): string {
  const keys = Object.keys(md);
  if (keys.length === 0) return "(empty)";
  const preview = keys.slice(0, 3).join(", ");
  return keys.length > 3 ? `${preview}, +${keys.length - 3}` : preview;
}

function badgeVariantFor(
  action: string
):
  | "default"
  | "active"
  | "pending"
  | "bounced"
  | "muted"
  | "unsubscribed" {
  if (action.includes("delete") || action.includes("fail")) return "bounced";
  if (action.includes("send") || action.includes("create")) return "active";
  if (action.includes("unsubscribe")) return "unsubscribed";
  if (action.includes("update") || action.includes("edit")) return "pending";
  return "muted";
}
