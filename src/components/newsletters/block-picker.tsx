"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BLOCK_TYPES,
  BLOCK_LABELS,
  BLOCK_DESCRIPTIONS,
  BLOCK_NEEDS_RESEARCH,
  type BlockType,
} from "@/types/newsletter";
import { ArticlePicker } from "@/components/articles/article-picker";

/**
 * A single entry in the block picker state. Represents one block that will
 * be included in the upcoming newsletter issue.
 */
export interface BlockConfig {
  /** Block type */
  type: BlockType;
  /** Free-text admin instruction passed to Claude for this specific block. */
  instructions: string;
  /**
   * If true, Claude will research/fill this block using collected articles.
   * If false, Claude emits placeholder content marked "{{ADMIN_FILL}}" that
   * the admin will replace manually in the draft editor.
   */
  autoSearch: boolean;
  /**
   * Admin-picked article IDs. When non-empty, those exact articles are
   * passed to Claude for this block — bypassing the normal category/date
   * partition. Empty = automatic selection.
   */
  forcedArticleIds: string[];
}

interface Props {
  blocks: BlockConfig[];
  onChange: (next: BlockConfig[]) => void;
}

export function BlockPicker({ blocks, onChange }: Props) {
  const selectedTypes = new Set(blocks.map((b) => b.type));
  const availableTypes = BLOCK_TYPES.filter((t) => !selectedTypes.has(t));

  /**
   * Map of articleId → block label that already uses it (first-match wins).
   * Passed to every block's ArticlePicker so admin sees where each article
   * is currently assigned and can avoid accidental duplicates.
   */
  const usageByArticleId = React.useMemo(() => {
    const map = new Map<string, string>();
    blocks.forEach((b) => {
      for (const id of b.forcedArticleIds ?? []) {
        if (!map.has(id)) map.set(id, BLOCK_LABELS[b.type]);
      }
    });
    return map;
  }, [blocks]);

  function addBlock(type: BlockType) {
    const newBlock: BlockConfig = {
      type,
      instructions: "",
      // groundk_story is admin-only — force autoSearch off
      autoSearch: type === "groundk_story" ? false : BLOCK_NEEDS_RESEARCH[type],
      forcedArticleIds: [],
    };
    onChange([...blocks, newBlock]);
  }

  function removeBlock(index: number) {
    const next = [...blocks];
    next.splice(index, 1);
    onChange(next);
  }

  function updateBlock(index: number, patch: Partial<BlockConfig>) {
    const next = [...blocks];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    next.splice(newIndex, 0, moved);
    onChange(next);
  }

  // HTML5 drag-drop ─────────────────────────
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [dragOver, setDragOver] = React.useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragging(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }
  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(index);
  }
  function handleDragLeave() {
    setDragOver(null);
  }
  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    const src = dragging;
    if (src === null || src === targetIndex) {
      setDragging(null);
      setDragOver(null);
      return;
    }
    const next = [...blocks];
    const [moved] = next.splice(src, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
    setDragging(null);
    setDragOver(null);
  }
  function handleDragEnd() {
    setDragging(null);
    setDragOver(null);
  }

  return (
    <div className="space-y-6">
      {/* ── Available blocks ───────────────────────── */}
      <div>
        <Label className="text-sm font-semibold">추가할 블록 선택</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">
          원하는 블록을 클릭하면 아래 목록에 추가됩니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {availableTypes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              모든 블록이 추가됨. 아래에서 순서를 조정하세요.
            </p>
          ) : (
            availableTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addBlock(t)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border bg-background hover:bg-muted transition"
                title={BLOCK_DESCRIPTIONS[t]}
              >
                <span className="text-primary">+</span>
                <span>{BLOCK_LABELS[t]}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Selected blocks (ordered + instructions) ───── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold">
            이번 호 구성 ({blocks.length}개 블록)
          </Label>
          {blocks.length > 0 && (
            <p className="text-xs text-muted-foreground">
              카드를 드래그하거나 ↑↓ 버튼으로 순서 변경
            </p>
          )}
        </div>

        {blocks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
            <p className="text-sm text-muted-foreground">
              아직 선택된 블록이 없습니다.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              위에서 이번 호에 포함할 블록을 선택하세요. (최소 1개 필요)
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.map((block, i) => (
              <div
                key={`${block.type}-${i}`}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "rounded-xl border bg-background transition",
                  dragging === i && "opacity-40",
                  dragOver === i && dragging !== i && "border-primary border-2",
                  dragging !== i && "border-border"
                )}
              >
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  {/* Drag handle */}
                  <span
                    className="cursor-grab active:cursor-grabbing text-muted-foreground select-none"
                    title="드래그해서 순서 변경"
                  >
                    ≡
                  </span>
                  <span className="text-xs font-mono text-muted-foreground w-6 text-center">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 font-medium text-sm">
                    {BLOCK_LABELS[block.type]}
                  </span>
                  {BLOCK_NEEDS_RESEARCH[block.type] && (
                    <Badge variant="muted">검색 필요</Badge>
                  )}
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => moveBlock(i, -1)}
                      disabled={i === 0}
                      title="위로"
                      className="h-7 w-7"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => moveBlock(i, 1)}
                      disabled={i === blocks.length - 1}
                      title="아래로"
                      className="h-7 w-7"
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeBlock(i)}
                      title="제거"
                      className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                    >
                      ×
                    </Button>
                  </div>
                </div>

                <div className="px-3 py-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {BLOCK_DESCRIPTIONS[block.type]}
                  </p>

                  {block.type === "groundk_story" ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      이 블록은 <strong>관리자 레퍼런스 전용</strong>입니다. 자동
                      검색이 적용되지 않으며, 아래 "추가 지시" 칸에 현장 브리핑과
                      프로젝트 자료를 직접 제공해 주세요. Claude는 제공된 자료를
                      분석하여 편집자 톤으로 다듬어 드립니다.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        id={`auto-${i}`}
                        type="checkbox"
                        checked={block.autoSearch}
                        onChange={(e) =>
                          updateBlock(i, { autoSearch: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label
                        htmlFor={`auto-${i}`}
                        className="cursor-pointer text-xs"
                      >
                        자동 생성 (Claude가 후보 기사로 작성)
                        {!block.autoSearch && (
                          <span className="text-amber-700 ml-1">
                            — placeholder만 생성, 수동 입력 필요
                          </span>
                        )}
                      </Label>
                    </div>
                  )}

                  {block.type !== "groundk_story" && block.autoSearch && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        이 블록에서 사용할 기사 (선택)
                      </Label>
                      <div className="mt-1">
                        <ArticlePicker
                          value={block.forcedArticleIds}
                          onChange={(ids) =>
                            updateBlock(i, { forcedArticleIds: ids })
                          }
                          articleUsedBy={Object.fromEntries(
                            Array.from(usageByArticleId.entries()).filter(
                              // Hide "used by" badge for articles this block
                              // itself picked — otherwise every selected chip
                              // would show a redundant self-reference.
                              ([id]) => !block.forcedArticleIds.includes(id)
                            )
                          )}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        지정하면 카테고리·기간 필터를 무시하고 이 기사들만 Claude에 전달합니다. 비워두면 자동 선별됩니다.
                      </p>
                    </div>
                  )}

                  <div>
                    <Label
                      htmlFor={`inst-${i}`}
                      className="text-xs text-muted-foreground"
                    >
                      {block.type === "groundk_story"
                        ? "현장 자료 / 프로젝트 설명 (필수)"
                        : "추가 지시 (선택, Claude에게 자연어로 전달)"}
                    </Label>
                    <Textarea
                      id={`inst-${i}`}
                      value={block.instructions}
                      onChange={(e) =>
                        updateBlock(i, { instructions: e.target.value })
                      }
                      rows={block.type === "groundk_story" ? 5 : 2}
                      className="text-xs mt-1"
                      placeholder={instructionPlaceholder(block.type)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function instructionPlaceholder(type: BlockType): string {
  switch (type) {
    case "opening_lede":
      return "예: 이번 호는 '인바운드 MICE 시장 변화' 주제로 훅을 잡아줘";
    case "stat_feature":
      return "예: 한국 MICE 참가자 만족도 관련 수치로";
    case "news_briefing":
      return "예: ESG 관련만 3개. 각 건 분량 짧게";
    case "in_out_comparison":
      return "예: IN은 코엑스/킨텍스 중심, OUT은 동남아 중심으로";
    case "tech_signal":
      return "예: Spatial Computing 주제로 다뤄줘";
    case "theory_to_field":
      return "예: 참가자 경험 설계 이론으로 다뤄줘";
    case "editor_take":
      return "예: 업계 번아웃 이슈를 다뤄줘";
    case "groundk_story":
      return "예: Project Sketch는 지난 주 COS 패션쇼 프로젝트로. Field Briefing은 공항 의전 지연 이슈";
    case "consolidated_insight":
      return "예: 3개 파트로 — 인바운드 변화 / AI 자동화 / ESG 압박";
    case "blog_card_grid":
      return "예: 4개 카드 — Field Note, Project Story, Industry Insight, Tech & MICE";
  }
}

/**
 * Default block selection for the new-draft form — modular Ver.1 layout.
 */
export const DEFAULT_BLOCK_CONFIGS: BlockConfig[] = [
  { type: "opening_lede", instructions: "", autoSearch: false, forcedArticleIds: [] },
  { type: "stat_feature", instructions: "", autoSearch: true, forcedArticleIds: [] },
  { type: "news_briefing", instructions: "", autoSearch: true, forcedArticleIds: [] },
  { type: "in_out_comparison", instructions: "", autoSearch: true, forcedArticleIds: [] },
  { type: "tech_signal", instructions: "", autoSearch: true, forcedArticleIds: [] },
  { type: "theory_to_field", instructions: "", autoSearch: true, forcedArticleIds: [] },
  { type: "editor_take", instructions: "", autoSearch: false, forcedArticleIds: [] },
  { type: "groundk_story", instructions: "", autoSearch: false, forcedArticleIds: [] },
];
