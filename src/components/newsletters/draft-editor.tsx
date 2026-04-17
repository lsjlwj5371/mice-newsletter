"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import {
  updateNewsletterContentAction,
  regenerateDraftAction,
} from "@/app/(admin)/newsletters/actions";
import {
  NEWSLETTER_STATUS_LABELS,
  type NewsletterRow,
} from "@/types/newsletter";

type ViewMode = "desktop" | "mobile" | "dark";

const VIEW_WIDTHS: Record<ViewMode, string> = {
  desktop: "720px",
  mobile: "390px",
  dark: "720px",
};

interface Props {
  newsletter: NewsletterRow;
  initialHtml: string;
}

export function DraftEditor({ newsletter, initialHtml }: Props) {
  const router = useRouter();
  const [mode, setMode] = React.useState<ViewMode>("desktop");
  const [tab, setTab] = React.useState<"preview" | "json">("preview");
  const [jsonText, setJsonText] = React.useState(
    () => JSON.stringify(newsletter.content_json, null, 2)
  );
  const [savePending, startSave] = React.useTransition();
  const [regeneratePending, startRegenerate] = React.useTransition();
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const wrappedHtml = React.useMemo(() => {
    if (mode !== "dark") return initialHtml;
    return `<!DOCTYPE html><html><head><style>
      html, body { margin: 0; padding: 0; background-color: #1a1a1a; }
      body > * { margin: 24px auto; }
    </style></head><body>${initialHtml}</body></html>`;
  }, [initialHtml, mode]);

  function handleSaveJson() {
    setMessage(null);
    startSave(async () => {
      const res = await updateNewsletterContentAction(newsletter.id, jsonText);
      if (res.ok) {
        setMessage({ type: "success", text: "저장되었습니다. 새로고침하면 미리보기에 반영됩니다." });
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error });
      }
    });
  }

  function handleRegenerate() {
    if (
      !confirm(
        "Claude에게 초안을 다시 생성하도록 요청합니다. 현재 편집한 내용은 모두 사라집니다. 계속할까요?"
      )
    ) {
      return;
    }
    setMessage(null);
    startRegenerate(async () => {
      const res = await regenerateDraftAction(newsletter.id);
      if (res.ok) {
        setMessage({ type: "success", text: "초안이 재생성되었습니다." });
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error });
      }
    });
  }

  return (
    <>
      <div className="px-8 py-4 border-b border-border bg-background flex items-center gap-3 flex-wrap">
        <Badge variant="pending">{NEWSLETTER_STATUS_LABELS[newsletter.status]}</Badge>
        <span className="text-sm text-muted-foreground">
          {newsletter.used_article_ids.length}건 기사 사용
        </span>
        <span className="text-xs text-muted-foreground">
          · 마지막 초안 생성: {formatDateTime(newsletter.last_drafted_at)}
        </span>
        <div className="ml-auto flex gap-2">
          <a
            href={`/api/newsletters/${newsletter.id}/html?download=1`}
            download
            className="inline-flex items-center h-9 px-4 rounded-md border border-border bg-background hover:bg-muted text-sm font-medium"
          >
            ↓ HTML 다운로드
          </a>
          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={regeneratePending || savePending}
          >
            {regeneratePending ? "재생성 중..." : "Claude 재생성"}
          </Button>
        </div>
      </div>

      <div className="px-8 py-4 border-b border-border bg-background flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          <Button
            size="sm"
            variant={tab === "preview" ? "primary" : "ghost"}
            onClick={() => setTab("preview")}
          >
            미리보기
          </Button>
          <Button
            size="sm"
            variant={tab === "json" ? "primary" : "ghost"}
            onClick={() => setTab("json")}
          >
            JSON 편집
          </Button>
        </div>

        {tab === "preview" && (
          <div className="flex gap-1 rounded-lg border border-border p-1">
            <Button
              size="sm"
              variant={mode === "desktop" ? "primary" : "ghost"}
              onClick={() => setMode("desktop")}
            >
              데스크톱
            </Button>
            <Button
              size="sm"
              variant={mode === "mobile" ? "primary" : "ghost"}
              onClick={() => setMode("mobile")}
            >
              모바일
            </Button>
            <Button
              size="sm"
              variant={mode === "dark" ? "primary" : "ghost"}
              onClick={() => setMode("dark")}
            >
              다크
            </Button>
          </div>
        )}
      </div>

      {message && (
        <div className="px-8 pt-4">
          <div
            className={
              message.type === "success"
                ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                : "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 whitespace-pre-wrap"
            }
          >
            {message.text}
          </div>
        </div>
      )}

      <div className="px-8 py-6">
        {tab === "preview" ? (
          <div className="flex justify-center bg-muted/40 rounded-xl border border-border py-8 px-4 overflow-x-auto">
            <iframe
              srcDoc={wrappedHtml}
              title="Newsletter preview"
              sandbox="allow-same-origin"
              style={{
                width: VIEW_WIDTHS[mode],
                maxWidth: "100%",
                height: "85vh",
                border: "1px solid #e5e5e5",
                borderRadius: mode === "mobile" ? "24px" : "8px",
                backgroundColor: "#ffffff",
                boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
              }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              JSON을 직접 편집한 뒤 <span className="font-medium">저장</span> 버튼을
              누르면 미리보기에 반영됩니다. 스키마 검증을 통과해야 저장됩니다.
              자연어 편집은 Phase 4.3에서 추가됩니다.
            </p>
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="font-mono text-xs"
              rows={32}
              spellCheck={false}
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveJson} disabled={savePending}>
                {savePending ? "저장 중..." : "저장"}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setJsonText(JSON.stringify(newsletter.content_json, null, 2))
                }
                disabled={savePending}
              >
                초기화
              </Button>
            </div>
          </div>
        )}
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
