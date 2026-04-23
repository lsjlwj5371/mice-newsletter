"use client";

import * as React from "react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Draft ID — used to fetch /api/newsletters/[id]/html. */
  newsletterId: string;
}

/**
 * Modal that shows the rendered HTML source of a newsletter draft.
 * Fetches on open and offers a one-click copy-to-clipboard so admins
 * can paste the HTML into an external sender (e.g. Naver Cloud
 * Outbound Mailer) without going through the .html file download
 * → open in editor → select all → copy cycle.
 */
export function HtmlSourceDialog({
  open,
  onOpenChange,
  newsletterId,
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const [html, setHtml] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setHtml(null);
      setError(null);
      setCopied(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/newsletters/${newsletterId}/html`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTML 로드 실패 (HTTP ${res.status})`);
        }
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setHtml(text);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, newsletterId]);

  async function handleCopy() {
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(
        "클립보드 복사에 실패했습니다. 텍스트 영역에서 직접 선택해 복사해 주세요."
      );
    }
  }

  const byteCount = html ? new Blob([html]).size : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>HTML 코드 보기</DialogTitle>
        <DialogDescription>
          렌더링된 이메일 HTML 전체 소스입니다. 외부 발송 도구(네이버
          Cloud 등)에 붙여넣기 할 때 사용하세요.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-3">
        {loading && (
          <div className="text-sm text-muted-foreground py-6 text-center">
            HTML 렌더링 중…
          </div>
        )}
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </div>
        )}
        {html && !loading && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {html.split(/\r?\n/).length.toLocaleString()}줄 ·{" "}
                {(byteCount / 1024).toFixed(1)}KB
              </span>
              <span className="text-amber-700">
                ⚠️ 수신자별 치환 전 상태 —{" "}
                <code className="px-1 py-0.5 rounded bg-amber-50 font-mono">
                  {"{{UNSUBSCRIBE_HREF}}"}
                </code>{" "}
                /{" "}
                <code className="px-1 py-0.5 rounded bg-amber-50 font-mono">
                  {"{{REFERRAL_HREF}}"}
                </code>{" "}
                플레이스홀더 포함
              </span>
            </div>
            <textarea
              value={html}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-[60vh] font-mono text-[11px] leading-relaxed p-3 rounded-md border border-border bg-muted/30 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              spellCheck={false}
            />
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          닫기
        </Button>
        <Button onClick={handleCopy} disabled={loading || !html}>
          {copied ? "✓ 복사됨" : "전체 복사"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
