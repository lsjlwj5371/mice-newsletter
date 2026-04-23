"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  markNcpAddedAction,
  markNcpRemovedAction,
} from "./actions";

export interface NcpPendingRow {
  id: string;
  email: string;
  name: string | null;
  organization: string | null;
  position: string | null;
  /** 추가 큐: source (initial/referral/manual). 제거 큐: status (unsubscribed/bounced). */
  source: string;
  at: string; // ISO timestamp
  /** 추가 큐에서만 사용 — 이 수신자를 추천한 기존 수신자의 이메일 */
  referrerEmail: string | null;
}

interface Props {
  addRows: NcpPendingRow[];
  removeRows: NcpPendingRow[];
}

type Tab = "adds" | "removes";

export function NcpSyncClient({ addRows, removeRows }: Props) {
  const [tab, setTab] = React.useState<Tab>("adds");

  return (
    <div className="space-y-4">
      {/* 탭 스위처 */}
      <div className="flex gap-1 border-b border-border">
        <TabButton
          active={tab === "adds"}
          onClick={() => setTab("adds")}
          label="NCP 추가 대기"
          count={addRows.length}
        />
        <TabButton
          active={tab === "removes"}
          onClick={() => setTab("removes")}
          label="NCP 제거 대기"
          count={removeRows.length}
        />
      </div>

      {/* 탭별 큐 */}
      {tab === "adds" ? (
        <QueueTable
          rows={addRows}
          kind="adds"
          emptyText="추가 대기 중인 신규 수신자가 없습니다."
          helpText="새로 구독하거나 추천받아 추가된 수신자 목록입니다. CSV로 내보내 네이버 Cloud 주소록에 업로드한 뒤 '처리 완료' 로 마킹하세요."
        />
      ) : (
        <QueueTable
          rows={removeRows}
          kind="removes"
          emptyText="제거 대기 중인 수신자가 없습니다."
          helpText="수신 거부하거나 바운스된 수신자 목록입니다. CSV로 내보내 네이버 Cloud 주소록에서 삭제한 뒤 '처리 완료' 로 마킹하세요."
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition " +
        (active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {label}
      <span
        className={
          "ml-2 text-xs px-1.5 py-0.5 rounded-full " +
          (count > 0
            ? "bg-amber-100 text-amber-800"
            : "bg-muted text-muted-foreground")
        }
      >
        {count}
      </span>
    </button>
  );
}

function QueueTable({
  rows,
  kind,
  emptyText,
  helpText,
}: {
  rows: NcpPendingRow[];
  kind: "adds" | "removes";
  emptyText: string;
  helpText: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  // rows 가 바뀌면 (서버 refresh 후) 선택 상태 초기화
  React.useEffect(() => {
    setSelected(new Set());
  }, [rows]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  function handleMarkDone() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (
      !confirm(
        `${ids.length}명을 '${
          kind === "adds" ? "NCP 추가 완료" : "NCP 제거 완료"
        }' 로 마킹할까요? 대기 목록에서 제거됩니다.`
      )
    )
      return;

    setMessage(null);
    startTransition(async () => {
      const res =
        kind === "adds"
          ? await markNcpAddedAction(ids)
          : await markNcpRemovedAction(ids);
      if (res.ok) {
        setMessage({
          type: "success",
          text: `${res.count}명 처리 완료로 마킹되었습니다.`,
        });
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error });
      }
    });
  }

  function handleDownloadCsv() {
    const ids = selected.size > 0 ? selected : new Set(rows.map((r) => r.id));
    const subset = rows.filter((r) => ids.has(r.id));
    const csv = toCsv(subset, kind);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ncp-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground leading-relaxed">
        {helpText}
      </p>

      {/* 액션 바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadCsv}
          disabled={rows.length === 0 || pending}
        >
          CSV 내보내기 ({selected.size > 0 ? selected.size : rows.length}명)
        </Button>
        <Button
          size="sm"
          onClick={handleMarkDone}
          disabled={selected.size === 0 || pending}
        >
          {pending ? "처리 중…" : `선택 ${selected.size}명 처리 완료`}
        </Button>
        {message && (
          <span
            className={
              "text-xs " +
              (message.type === "success" ? "text-emerald-700" : "text-rose-700")
            }
          >
            {message.text}
          </span>
        )}
      </div>

      {/* 테이블 */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === rows.length && rows.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2 text-left">이메일</th>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">조직</th>
                <th className="px-3 py-2 text-left">
                  {kind === "adds" ? "구분" : "상태"}
                </th>
                <th className="px-3 py-2 text-left">
                  {kind === "adds" ? "가입일" : "요청일"}
                </th>
                {kind === "adds" && (
                  <th className="px-3 py-2 text-left">추천인</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                  <td className="px-3 py-2">{r.name ?? "-"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.organization ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    <SourceBadge source={r.source} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(r.at)}
                  </td>
                  {kind === "adds" && (
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.referrerEmail ?? "-"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    referral: { label: "추천", cls: "bg-sky-100 text-sky-800" },
    manual: { label: "직접 등록", cls: "bg-slate-100 text-slate-800" },
    initial: { label: "초기", cls: "bg-slate-100 text-slate-800" },
    unsubscribed: { label: "수신 거부", cls: "bg-amber-100 text-amber-800" },
    bounced: { label: "바운스", cls: "bg-rose-100 text-rose-800" },
  };
  const entry = map[source] ?? {
    label: source,
    cls: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${entry.cls}`}
    >
      {entry.label}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function toCsv(rows: NcpPendingRow[], kind: "adds" | "removes"): string {
  const headers =
    kind === "adds"
      ? ["email", "name", "organization", "position", "source", "created_at", "referrer"]
      : ["email", "name", "organization", "status", "requested_at"];

  const lines: string[] = [headers.join(",")];
  for (const r of rows) {
    const cols =
      kind === "adds"
        ? [
            r.email,
            r.name ?? "",
            r.organization ?? "",
            r.position ?? "",
            r.source,
            r.at,
            r.referrerEmail ?? "",
          ]
        : [r.email, r.name ?? "", r.organization ?? "", r.source, r.at];
    lines.push(cols.map(csvEscape).join(","));
  }
  // Add BOM so Excel opens with UTF-8 encoding for Korean characters
  return "\uFEFF" + lines.join("\n");
}

function csvEscape(v: string): string {
  if (v == null) return "";
  const needsQuote = /[",\n\r]/.test(v);
  const escaped = v.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}
