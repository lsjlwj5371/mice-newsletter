"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { createDraftNewsletterAction } from "@/app/(admin)/newsletters/actions";

export function NewDraftForm() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [usePeriod, setUsePeriod] = React.useState(true);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatusMessage("Claude가 후보 기사를 분석하고 11개 섹션 초안을 작성하는 중입니다… (30초~1분 소요)");

    const formData = new FormData(e.currentTarget);
    // Strip period if user opted out
    if (!usePeriod) {
      formData.delete("periodStart");
      formData.delete("periodEnd");
    }

    startTransition(async () => {
      const result = await createDraftNewsletterAction(formData);
      if (result.ok && result.id) {
        router.push(`/newsletters/${result.id}` as never);
      } else if (!result.ok) {
        setError(result.error);
        setStatusMessage(null);
      }
    });
  }

  // Default period: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStr = formatDateForInput(today);
  const thirtyAgoStr = formatDateForInput(thirtyDaysAgo);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <Label htmlFor="issueLabel">호 이름 *</Label>
        <Input
          id="issueLabel"
          name="issueLabel"
          required
          placeholder="VOL.02 · 2026년 5월호"
          defaultValue={`VOL · ${today.getFullYear()}년 ${
            today.getMonth() + 1
          }월호`}
          autoFocus
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          뉴스레터 상단·관리 화면에 표시되는 호 식별 라벨
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            id="usePeriod"
            type="checkbox"
            checked={usePeriod}
            onChange={(e) => setUsePeriod(e.target.checked)}
            disabled={pending}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="usePeriod" className="cursor-pointer">
            기간으로 후보 기사 필터링
          </Label>
        </div>
        {usePeriod && (
          <div className="grid grid-cols-2 gap-4 pl-6">
            <div className="space-y-1">
              <Label htmlFor="periodStart">시작</Label>
              <Input
                id="periodStart"
                name="periodStart"
                type="date"
                defaultValue={thirtyAgoStr}
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="periodEnd">종료</Label>
              <Input
                id="periodEnd"
                name="periodEnd"
                type="date"
                defaultValue={todayStr}
                disabled={pending}
              />
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {usePeriod
            ? "이 기간 안에 수집된 기사만 사용. 종료일은 그 날 끝까지 포함됩니다."
            : "체크 해제 — 수집된 모든 기사 중에서 Claude가 선택합니다."}
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="referenceNotes">사전 레퍼런스 / 인사이트 (선택)</Label>
        <Textarea
          id="referenceNotes"
          name="referenceNotes"
          rows={6}
          placeholder={`이번 호에 꼭 포함했으면 하는 내용을 자유롭게 적어주세요.\n\n예시:\n- 그라운드케이가 지난 주 진행한 'COS 패션쇼' 프로젝트를 GROUNDK STORY > Project Sketch에 넣어줘\n- 인천공항 T2 수하물 지연 이슈는 Field Briefing에 반영\n- Editor's Take는 '이벤트 산업의 ESG 압박' 주제로`}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          여기 적은 내용은 GROUNDK STORY 섹션을 우선 채우는 데 사용되며, 다른
          섹션에도 관련 있다면 반영됩니다.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="perCategoryLimit">카테고리당 후보 기사 수</Label>
        <Input
          id="perCategoryLimit"
          name="perCategoryLimit"
          type="number"
          min="3"
          max="20"
          defaultValue="8"
          disabled={pending}
          className="max-w-[120px]"
        />
        <p className="text-xs text-muted-foreground">
          각 카테고리(news/mice_in_out/tech/theory)에서 중요도 순으로 N개 기사를
          Claude에게 전달합니다. 너무 많으면 토큰 비용 증가, 너무 적으면 선택지
          부족.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {statusMessage && pending && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 flex items-start gap-3">
          <div className="h-4 w-4 mt-0.5 rounded-full border-2 border-amber-700 border-t-transparent animate-spin shrink-0" />
          <div>{statusMessage}</div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "초안 생성 중..." : "초안 생성하기"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          취소
        </Button>
      </div>
    </form>
  );
}

function formatDateForInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
