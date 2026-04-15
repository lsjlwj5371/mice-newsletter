"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { RssFeedFormDialog } from "./rss-feed-form-dialog";
import { triggerCollectionAction } from "@/app/(admin)/rss/actions";

export function RssToolbar({ feedCount }: { feedCount: number }) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  function handleManualRun() {
    setResult(null);
    startTransition(async () => {
      const res = await triggerCollectionAction();
      if (res.ok) {
        setResult({
          type: "success",
          message: res.message ?? "수집 완료",
        });
      } else {
        setResult({ type: "error", message: res.error });
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          등록된 피드 <span className="font-medium text-foreground">{feedCount}</span>개
          · 매일 새벽 5시 KST에 자동 수집됩니다
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleManualRun}
            disabled={pending || feedCount === 0}
            title={feedCount === 0 ? "먼저 피드를 추가하세요" : "지금 수집 + 분석 실행"}
          >
            {pending ? "수집 중..." : "지금 수집 실행"}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>+ 피드 추가</Button>
        </div>
      </div>

      {result && (
        <div
          className={
            result.type === "success"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          }
        >
          {result.message}
        </div>
      )}

      <RssFeedFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
