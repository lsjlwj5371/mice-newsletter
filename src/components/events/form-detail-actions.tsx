"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  setFormOpenAction,
  deleteFormAction,
} from "@/app/(admin)/events/actions";

export function FormDetailActions({
  formId,
  isOpen,
  shareUrl,
}: {
  formId: string;
  isOpen: boolean;
  shareUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMsg("공유 URL을 복사했습니다");
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg("복사 실패 — URL을 직접 선택해 복사하세요");
    }
  }

  function handleToggleOpen() {
    const label = isOpen ? "응답 마감" : "응답 재개";
    if (!confirm(`이 폼을 ${label}할까요?`)) return;
    startTransition(async () => {
      const res = await setFormOpenAction(formId, !isOpen);
      if (res.ok) {
        setMsg(`${label} 완료`);
        router.refresh();
      } else {
        setMsg(`실패: ${res.error}`);
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        "이 폼과 모든 응답을 영구 삭제합니다. 취소할 수 없습니다. 계속할까요?"
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteFormAction(formId);
      if (res.ok) {
        router.push("/events" as never);
      } else {
        setMsg(`실패: ${res.error}`);
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div>
        <label className="text-xs font-semibold">공유 URL</label>
        <div className="flex gap-2 mt-1">
          <Input value={shareUrl} readOnly className="font-mono text-xs" />
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyUrl}
            type="button"
          >
            복사
          </Button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center h-9 px-3 rounded-md border border-border bg-background hover:bg-muted text-xs"
          >
            새 탭 열기
          </a>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          이 URL을 뉴스레터 본문의 버튼이나 링크 텍스트에 삽입하세요. 응답이
          쌓이면 아래 표에 자동으로 나타납니다.
        </p>
      </div>

      <div className="flex gap-2 pt-3 border-t border-border">
        <Button
          size="sm"
          variant={isOpen ? "outline" : "primary"}
          onClick={handleToggleOpen}
          disabled={pending}
        >
          {pending ? "..." : isOpen ? "응답 마감" : "응답 재개"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-rose-600 ml-auto"
          onClick={handleDelete}
          disabled={pending}
        >
          폼 삭제
        </Button>
      </div>

      {msg && (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          {msg}
        </div>
      )}
    </section>
  );
}
