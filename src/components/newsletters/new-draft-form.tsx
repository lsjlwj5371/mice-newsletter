"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { BlockPicker, DEFAULT_BLOCK_CONFIGS, type BlockConfig } from "./block-picker";
import { createDraftWithBlocksAction } from "@/app/(admin)/newsletters/actions";

interface Props {
  /** Server-computed suggestion for the next issue number. Defaults to 1
   *  when loading fails. Admin can still type anything into the field. */
  defaultIssueNumber: number;
}

export function NewDraftForm({ defaultIssueNumber }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  // Form state
  const today = new Date();
  // Default to a simple "N호" label based on current newsletter count.
  // Admin frequently publishes off a cadence (주간 / 이슈 기반), so the
  // month label we used before was misleading. The input stays fully
  // editable for special editions ("창간호", "특별호 · YYYY" 등).
  const defaultIssueLabel = `${defaultIssueNumber}호`;
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStr = formatDateForInput(today);
  const thirtyAgoStr = formatDateForInput(thirtyDaysAgo);

  const [issueLabel, setIssueLabel] = React.useState(defaultIssueLabel);
  const [usePeriod, setUsePeriod] = React.useState(true);
  const [periodStart, setPeriodStart] = React.useState(thirtyAgoStr);
  const [periodEnd, setPeriodEnd] = React.useState(todayStr);
  const [referenceNotes, setReferenceNotes] = React.useState("");
  const [perCategoryLimit, setPerCategoryLimit] = React.useState(8);
  const [blocks, setBlocks] = React.useState<BlockConfig[]>(DEFAULT_BLOCK_CONFIGS);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (blocks.length === 0) {
      setError("최소 하나 이상의 블록을 선택해 주세요.");
      return;
    }

    const autoSearchCount = blocks.filter((b) => b.autoSearch).length;
    const statusMsg = autoSearchCount > 0
      ? `Claude가 ${autoSearchCount}개 블록의 내용을 후보 기사로 작성하는 중입니다… (블록 수에 따라 20~50초)`
      : "블록 구조 생성 중입니다…";
    setStatusMessage(statusMsg);

    startTransition(async () => {
      try {
        const result = await createDraftWithBlocksAction({
          issueLabel,
          periodStart: usePeriod ? periodStart : null,
          periodEnd: usePeriod ? periodEnd : null,
          perCategoryLimit,
          referenceNotes: referenceNotes.trim() || null,
          blocks: blocks.map((b) => ({
            type: b.type,
            instructions: b.instructions.trim() || null,
            autoSearch: b.autoSearch,
            forcedArticleIds:
              b.forcedArticleIds.length > 0
                ? b.forcedArticleIds
                : undefined,
            showFieldBriefing:
              b.type === "groundk_story"
                ? b.showFieldBriefing ?? true
                : undefined,
            showProjectSketch:
              b.type === "groundk_story"
                ? b.showProjectSketch ?? true
                : undefined,
          })),
        });

        if (result.ok && result.id) {
          router.push(`/newsletters/${result.id}` as never);
        } else if (!result.ok) {
          setError(result.error);
          setStatusMessage(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(
          `서버 응답 오류: ${msg}\n\n` +
            "보통 Claude 생성이 60초 함수 한도를 넘어서 발생합니다. " +
            "블록 수를 줄이거나 '카테고리당 후보 기사 수'를 낮춰서(예: 4) 다시 시도해 보세요."
        );
        setStatusMessage(null);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {/* ── Basics ─────────────────────── */}
      <section className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="issueLabel">호 이름 *</Label>
          <Input
            id="issueLabel"
            value={issueLabel}
            onChange={(e) => setIssueLabel(e.target.value)}
            required
            placeholder="예: 1호, 창간호, 특별호 — VOL.01 · 2026 여름 등"
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">
            기존 뉴스레터 수를 바탕으로 다음 호 번호를 자동으로 제안합니다.
            창간호·특별호 등 원하는 이름을 자유롭게 입력해도 됩니다.
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
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="periodEnd">종료</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
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
          <Label htmlFor="perCategoryLimit">카테고리당 후보 기사 수</Label>
          <Input
            id="perCategoryLimit"
            type="number"
            min="3"
            max="20"
            value={perCategoryLimit}
            onChange={(e) => setPerCategoryLimit(parseInt(e.target.value, 10))}
            disabled={pending}
            className="max-w-[120px]"
          />
          <p className="text-xs text-muted-foreground">
            각 카테고리에서 중요도 순으로 N개 기사를 Claude에게 전달. 블록 수가
            많으면 8 이상도 OK, 빠른 생성이 필요하면 4~5 추천.
          </p>
        </div>
      </section>

      {/* ── Block picker ──────────────── */}
      <section className="border-t border-border pt-6">
        <BlockPicker blocks={blocks} onChange={setBlocks} />
      </section>

      {/* ── Global references ─────────── */}
      <section className="border-t border-border pt-6 space-y-1">
        <Label htmlFor="referenceNotes">
          전체 사전 레퍼런스 / 인사이트 (선택)
        </Label>
        <Textarea
          id="referenceNotes"
          value={referenceNotes}
          onChange={(e) => setReferenceNotes(e.target.value)}
          rows={6}
          placeholder={`이번 호 전체에 공통으로 적용할 맥락이나 강조할 주제를 적어주세요.\n(특정 블록 전용 지시는 블록 카드의 "추가 지시" 칸에 적으세요)\n\n예시:\n- 이번 호 전체 테마는 "인바운드 MICE 변곡점"\n- 그라운드케이가 지난 주 진행한 COS 패션쇼는 Project Sketch에 포함`}
          disabled={pending}
        />
      </section>

      {/* ── Errors / Status ───────────── */}
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

      {/* ── Submit ────────────────────── */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button type="submit" disabled={pending || blocks.length === 0}>
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
