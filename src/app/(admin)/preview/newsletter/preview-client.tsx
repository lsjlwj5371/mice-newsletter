"use client";

import * as React from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

type ViewMode = "desktop" | "mobile" | "dark";

const VIEW_WIDTHS: Record<ViewMode, string> = {
  desktop: "720px",
  mobile: "390px",
  dark: "720px",
};

export function PreviewClient({
  html,
  subject,
}: {
  html: string;
  subject: string;
}) {
  const [mode, setMode] = React.useState<ViewMode>("desktop");

  // For dark mode preview we wrap the email HTML inside a dark page background
  // so the user can see how the email's white card sits on a dark inbox.
  const wrappedHtml = React.useMemo(() => {
    if (mode !== "dark") return html;
    return `<!DOCTYPE html><html><head><style>
      html, body { margin: 0; padding: 0; background-color: #1a1a1a; }
      body > * { margin: 24px auto; }
    </style></head><body>${html}</body></html>`;
  }, [html, mode]);

  return (
    <>
      <PageHeader
        title="템플릿 미리보기"
        description="현재 디자인 베이스. Phase 4.2부터는 실제 호 데이터를 미리볼 수 있습니다."
        actions={
          <div className="flex gap-1 rounded-lg border border-border bg-background p-1">
            <ModeButton
              active={mode === "desktop"}
              onClick={() => setMode("desktop")}
              label="데스크톱"
            />
            <ModeButton
              active={mode === "mobile"}
              onClick={() => setMode("mobile")}
              label="모바일"
            />
            <ModeButton
              active={mode === "dark"}
              onClick={() => setMode("dark")}
              label="다크"
            />
          </div>
        }
      />
      <div className="px-8 py-6 space-y-4">
        <div className="rounded-md border border-border bg-background px-4 py-3 text-sm">
          <span className="text-muted-foreground">제목 줄: </span>
          <span className="font-medium">{subject}</span>
        </div>

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

        <details className="rounded-md border border-border bg-background px-4 py-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            HTML 소스 보기 (개발자용)
          </summary>
          <pre className="mt-3 max-h-96 overflow-auto rounded bg-muted/40 p-3 text-[10px] font-mono">
            {html}
          </pre>
        </details>
      </div>
    </>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "primary" : "ghost"}
      onClick={onClick}
      className="px-3"
    >
      {label}
    </Button>
  );
}
