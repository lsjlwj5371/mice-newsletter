"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea, Label } from "@/components/ui/input";
import {
  updateNewsletterContentAction,
  regenerateDraftAction,
  regenerateBlockAction,
  addBlockAction,
  removeBlockAction,
  moveBlockAction,
  setGroundkStoryVisibilityAction,
  updateNewsletterSubjectAction,
  setBlockSourceUrlAction,
} from "@/app/(admin)/newsletters/actions";
import { Input } from "@/components/ui/input";
import { BlockImageSlot } from "./block-image-slot";
import { SendPanel } from "./send-panel";
import { ArticlePicker } from "@/components/articles/article-picker";
import {
  NEWSLETTER_STATUS_LABELS,
  BLOCK_LABELS,
  BLOCK_DESCRIPTIONS,
  BLOCK_NEEDS_RESEARCH,
  BLOCK_TYPES,
  type BlockType,
  type NewsletterRow,
  type BlockInstance,
  type ImageLayout,
} from "@/types/newsletter";

type ViewMode = "desktop" | "mobile" | "dark";

const VIEW_WIDTHS: Record<ViewMode, string> = {
  desktop: "720px",
  mobile: "390px",
  dark: "720px",
};

export interface ArticleMetaEntry {
  title: string;
  url: string;
  source: string | null;
  category: string;
}

interface Props {
  newsletter: NewsletterRow;
  initialHtml: string;
  /** Title/URL lookup for all referencedArticleIds across all blocks. */
  articleMeta: Record<string, ArticleMetaEntry>;
  /** Count of recipients with status='active' for the send panel. */
  activeRecipientCount: number;
  /** Scheduled-send timestamp (ISO), or null when not scheduled. */
  scheduledAt: string | null;
  /** Server-rendered SendHistory component passed through as a slot. */
  sendHistorySlot: React.ReactNode;
}

export function DraftEditor({
  newsletter,
  initialHtml,
  articleMeta,
  activeRecipientCount,
  scheduledAt,
  sendHistorySlot,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = React.useState<ViewMode>("desktop");
  const [tab, setTab] = React.useState<"preview" | "blocks" | "send" | "json">(
    "preview"
  );
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

  function handleRegenerateAll() {
    if (
      !confirm(
        "전체 호를 Claude에게 다시 생성하도록 요청합니다. 현재 편집한 내용이 모두 사라집니다. 계속할까요?"
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
      {/* ── Subject line (email 제목) — inline-editable ──── */}
      <SubjectEditor
        newsletterId={newsletter.id}
        initialSubject={newsletter.subject}
        disabled={newsletter.status === "sent"}
      />

      {/* ── Top status bar ──────────────────────────────── */}
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
            onClick={handleRegenerateAll}
            disabled={regeneratePending || savePending}
            title="전체 블록을 한 번에 다시 생성"
          >
            {regeneratePending ? "전체 재생성 중..." : "전체 재생성"}
          </Button>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────── */}
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
            variant={tab === "blocks" ? "primary" : "ghost"}
            onClick={() => setTab("blocks")}
          >
            블록 편집
          </Button>
          <Button
            size="sm"
            variant={tab === "send" ? "primary" : "ghost"}
            onClick={() => setTab("send")}
          >
            발송
          </Button>
          <Button
            size="sm"
            variant={tab === "json" ? "primary" : "ghost"}
            onClick={() => setTab("json")}
          >
            JSON
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

      {/* ── Global message ─────────────────────────────── */}
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

      {/* ── Content panels ─────────────────────────────── */}
      <div className="px-8 py-6">
        {tab === "preview" && (
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
        )}

        {tab === "blocks" && (
          <BlockEditorPanel
            newsletterId={newsletter.id}
            blocks={newsletter.content_json.blocks}
            articleMeta={articleMeta}
            disabled={regeneratePending || savePending}
            onDone={() => router.refresh()}
          />
        )}

        {tab === "send" && (
          <div className="space-y-6">
            <SendPanel
              newsletterId={newsletter.id}
              status={newsletter.status}
              activeRecipientCount={activeRecipientCount}
              scheduledAt={scheduledAt}
            />
            {sendHistorySlot}
          </div>
        )}

        {tab === "json" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              JSON을 직접 편집한 뒤 <span className="font-medium">저장</span> 버튼을
              누르면 미리보기에 반영됩니다. 스키마 검증을 통과해야 저장됩니다.
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

// ─────────────────────────────────────────────
// Block editor panel — per-block references + regenerate
// ─────────────────────────────────────────────

interface BlockEditorPanelProps {
  newsletterId: string;
  blocks: BlockInstance[];
  articleMeta: Record<string, ArticleMetaEntry>;
  disabled: boolean;
  onDone: () => void;
}

function BlockEditorPanel({
  newsletterId,
  blocks,
  articleMeta,
  disabled,
  onDone,
}: BlockEditorPanelProps) {
  /**
   * For every referenced article in this newsletter, remember which block
   * uses it. `articleUsageByBlockIndex[i]` is the usage map EXCLUDING
   * block i — pass that to each BlockCard's picker so an article the
   * card itself already uses doesn't show a redundant self-warning.
   */
  const { addBlockUsage, perBlockExcluded } = React.useMemo(() => {
    const fullMap = new Map<string, string>();
    blocks.forEach((b) => {
      for (const id of b.referencedArticleIds ?? []) {
        if (!fullMap.has(id)) fullMap.set(id, BLOCK_LABELS[b.type]);
      }
    });

    const addMap: Record<string, string> = {};
    for (const [id, label] of fullMap) addMap[id] = label;

    const per: Record<number, Record<string, string>> = {};
    blocks.forEach((b, i) => {
      const selfIds = new Set(b.referencedArticleIds ?? []);
      const m: Record<string, string> = {};
      for (const [id, label] of fullMap) {
        if (!selfIds.has(id)) m[id] = label;
      }
      per[i] = m;
    });

    return { addBlockUsage: addMap, perBlockExcluded: per };
  }, [blocks]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        각 블록의 참고 자료를 확인하고, 마음에 안 들면 이 블록만 다시 생성할 수 있습니다.
        추가 지시 칸에 자연어로 원하는 방향을 적어 주세요 (예: "2번 기사는 관련 없으니 빼줘",
        "분량을 절반으로 줄여줘", "Agentic AI 대신 Spatial Computing으로 바꿔줘").
        블록 사이의 "+ 여기에 블록 추가" 버튼으로 새 블록을 끼워 넣거나 순서를 바꿀 수도 있습니다.
      </p>

      <AddBlockInsertionPoint
        newsletterId={newsletterId}
        position={0}
        disabled={disabled}
        onDone={onDone}
        articleUsedBy={addBlockUsage}
      />

      {blocks.map((block, i) => (
        <React.Fragment key={block.id + i}>
          <BlockCard
            newsletterId={newsletterId}
            block={block}
            blockIndex={i}
            totalBlocks={blocks.length}
            articleMeta={articleMeta}
            disabled={disabled}
            onDone={onDone}
            articleUsedBy={perBlockExcluded[i] ?? {}}
          />
          <AddBlockInsertionPoint
            newsletterId={newsletterId}
            position={i + 1}
            disabled={disabled}
            onDone={onDone}
            articleUsedBy={addBlockUsage}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Insertion point — "+ 여기에 블록 추가" between every pair of cards
// Expands into a block-type picker inline.
// ─────────────────────────────────────────────
interface AddBlockInsertionPointProps {
  newsletterId: string;
  position: number;
  disabled: boolean;
  onDone: () => void;
  /** Article usage across sibling blocks — shown as a warning in the picker. */
  articleUsedBy?: Record<string, string>;
}

function AddBlockInsertionPoint({
  newsletterId,
  position,
  disabled,
  onDone,
  articleUsedBy,
}: AddBlockInsertionPointProps) {
  const [open, setOpen] = React.useState(false);
  const [blockType, setBlockType] = React.useState<BlockType>("news_briefing");
  const [autoSearch, setAutoSearch] = React.useState(true);
  const [instructions, setInstructions] = React.useState("");
  const [forcedArticleIds, setForcedArticleIds] = React.useState<string[]>([]);
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    // Sync autoSearch default when the picked type changes.
    setAutoSearch(BLOCK_NEEDS_RESEARCH[blockType]);
  }, [blockType]);

  function handleAdd() {
    setMsg(null);
    startTransition(async () => {
      const res = await addBlockAction({
        newsletterId,
        position,
        blockType,
        instructions: instructions.trim() || null,
        autoSearch: blockType === "groundk_story" ? false : autoSearch,
        forcedArticleIds:
          forcedArticleIds.length > 0 ? forcedArticleIds : undefined,
      });
      if (res.ok) {
        setMsg({ type: "success", text: res.message ?? "추가됨" });
        setInstructions("");
        setForcedArticleIds([]);
        setOpen(false);
        onDone();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || pending}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md hover:border-foreground/40 hover:bg-muted/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="text-sm">+</span> 여기에 블록 추가
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">새 블록 추가 (위치 {position + 1})</Label>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMsg(null);
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
          disabled={pending}
        >
          취소
        </button>
      </div>

      <div>
        <Label htmlFor={`bt-${position}`} className="text-xs">
          블록 타입
        </Label>
        <select
          id={`bt-${position}`}
          value={blockType}
          onChange={(e) => setBlockType(e.target.value as BlockType)}
          disabled={pending}
          className="mt-1 w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {BLOCK_TYPES.map((t) => (
            <option key={t} value={t}>
              {BLOCK_LABELS[t]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {BLOCK_DESCRIPTIONS[blockType]}
        </p>
      </div>

      {blockType !== "groundk_story" && (
        <>
          <div className="flex items-center gap-2">
            <input
              id={`as-${position}`}
              type="checkbox"
              checked={autoSearch}
              onChange={(e) => setAutoSearch(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 rounded border-border"
            />
            <Label
              htmlFor={`as-${position}`}
              className="cursor-pointer text-xs"
            >
              자동 생성 (Claude가 후보 기사 참조)
            </Label>
          </div>
          {autoSearch && (
            <div>
              <Label className="text-xs">이 블록에서 사용할 기사 (선택)</Label>
              <div className="mt-1">
                <ArticlePicker
                  value={forcedArticleIds}
                  onChange={setForcedArticleIds}
                  disabled={pending}
                  articleUsedBy={articleUsedBy}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                직접 지정하면 카테고리·기간 필터를 무시하고 이 기사들만 Claude에 전달합니다. 비워두면 자동 선별됩니다.
              </p>
            </div>
          )}
        </>
      )}

      <div>
        <Label className="text-xs">추가 지시 (선택)</Label>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          disabled={pending}
          placeholder={
            blockType === "groundk_story"
              ? "예: Field Briefing은 공항 T2 수하물 판독 이슈, Project Sketch는 COS 패션쇼"
              : "예: 이번엔 ESG 관련만, 분량은 짧게"
          }
          className="mt-1 text-xs"
        />
      </div>

      {msg && (
        <div
          className={
            msg.type === "success"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
              : "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 whitespace-pre-wrap"
          }
        >
          {msg.text}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleAdd} disabled={pending}>
          {pending ? "생성 중..." : "추가"}
        </Button>
      </div>
    </div>
  );
}

interface BlockCardProps {
  newsletterId: string;
  block: BlockInstance;
  blockIndex: number;
  totalBlocks: number;
  articleMeta: Record<string, ArticleMetaEntry>;
  disabled: boolean;
  onDone: () => void;
  /** Articles used by SIBLING blocks — shown as warnings in the picker. */
  articleUsedBy?: Record<string, string>;
}

function BlockCard({
  newsletterId,
  block,
  blockIndex,
  totalBlocks,
  articleMeta,
  disabled,
  onDone,
  articleUsedBy,
}: BlockCardProps) {
  const [instructions, setInstructions] = React.useState(
    block.instructions ?? ""
  );
  const [autoSearch, setAutoSearch] = React.useState(
    block.autoSearch ?? BLOCK_NEEDS_RESEARCH[block.type]
  );
  const [forcedArticleIds, setForcedArticleIds] = React.useState<string[]>([]);
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  const refIds = block.referencedArticleIds ?? [];

  const [structPending, startStruct] = React.useTransition();

  function handleMove(direction: "up" | "down") {
    setMsg(null);
    startStruct(async () => {
      const res = await moveBlockAction(newsletterId, blockIndex, direction);
      if (res.ok) {
        onDone();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  function handleRemove() {
    if (!confirm(`"${BLOCK_LABELS[block.type]}" 블록을 삭제할까요?`)) return;
    setMsg(null);
    startStruct(async () => {
      const res = await removeBlockAction(newsletterId, blockIndex);
      if (res.ok) {
        onDone();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  function handleRegenerate() {
    setMsg(null);
    // groundk_story is admin-only — always pass autoSearch=false regardless
    // of UI state so it never pulls from RSS.
    const effectiveAutoSearch =
      block.type === "groundk_story" ? false : autoSearch;
    startTransition(async () => {
      const res = await regenerateBlockAction({
        newsletterId,
        blockIndex,
        instructions: instructions.trim() || null,
        autoSearch: effectiveAutoSearch,
        forcedArticleIds:
          forcedArticleIds.length > 0 ? forcedArticleIds : undefined,
      });
      if (res.ok) {
        setMsg({ type: "success", text: "재생성 완료" });
        onDone();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  const titlePreview = getBlockTitle(block);

  const busy = pending || disabled || structPending;

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <div className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/40 transition">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <span className="text-xs font-mono text-muted-foreground w-6 text-center">
            {String(blockIndex + 1).padStart(2, "0")}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">
              {BLOCK_LABELS[block.type]}
            </div>
            {titlePreview && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {titlePreview}
              </div>
            )}
          </div>
          {refIds.length > 0 && (
            <Badge variant="muted">참고 {refIds.length}건</Badge>
          )}
          <span className="text-muted-foreground text-xs">
            {expanded ? "▾" : "▸"}
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => handleMove("up")}
            disabled={busy || blockIndex === 0}
            title="위로 이동"
            className="w-7 h-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => handleMove("down")}
            disabled={busy || blockIndex === totalBlocks - 1}
            title="아래로 이동"
            className="w-7 h-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy || totalBlocks <= 1}
            title={totalBlocks <= 1 ? "최소 1개 블록은 필요합니다" : "삭제"}
            className="w-7 h-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/20">
          {/* References */}
          <section>
            <Label className="text-xs font-semibold">
              참고한 자료 ({refIds.length}건)
            </Label>
            {refIds.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                {BLOCK_NEEDS_RESEARCH[block.type]
                  ? "이 블록에 전달된 후보 기사가 없거나, 자동 검색이 꺼져 있었습니다."
                  : "이 블록은 외부 기사를 참조하지 않는 타입입니다."}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-xs">
                {refIds.map((id) => {
                  const meta = articleMeta[id];
                  if (!meta) {
                    return (
                      <li key={id} className="text-muted-foreground italic">
                        (기사 정보를 찾을 수 없음 — 아마 삭제됨: {id.slice(0, 8)}…)
                      </li>
                    );
                  }
                  return (
                    <li key={id} className="flex gap-2">
                      <Badge variant="muted">{meta.category}</Badge>
                      <a
                        href={meta.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-blue-600 hover:underline line-clamp-2"
                        title={meta.title}
                      >
                        {meta.title}
                      </a>
                      {meta.source && (
                        <span className="text-muted-foreground shrink-0">
                          · {meta.source}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Image upload slot(s) */}
          <div className="rounded-md border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
            💡 <strong className="text-foreground">이미지만</strong> 추가·교체하고 싶다면 아래 이미지 영역의
            &quot;이미지 업로드&quot;만 사용하세요. 본문은 그대로 유지됩니다.
          </div>
          {block.type === "groundk_story" ? (
            <div className="space-y-4">
              <GroundkStoryVisibilityToggles
                newsletterId={newsletterId}
                blockIndex={blockIndex}
                showFieldBriefing={
                  (block.data as { showFieldBriefing?: boolean })
                    .showFieldBriefing !== false
                }
                showProjectSketch={
                  (block.data as { showProjectSketch?: boolean })
                    .showProjectSketch !== false
                }
                disabled={pending || disabled}
                onDone={onDone}
              />
              <BlockImageSlot
                newsletterId={newsletterId}
                blockIndex={blockIndex}
                slot="fieldBriefing"
                label="현장 브리핑 이미지 (선택)"
                currentUrl={
                  (
                    (block.data as {
                      fieldBriefing?: { imageUrl?: string };
                    }).fieldBriefing?.imageUrl ?? undefined
                  ) || null
                }
                currentLayout={
                  (block.data as {
                    fieldBriefing?: { imageLayout?: ImageLayout };
                  }).fieldBriefing?.imageLayout ?? null
                }
                disabled={pending || disabled}
              />
              <BlockImageSlot
                newsletterId={newsletterId}
                blockIndex={blockIndex}
                slot="projectSketch"
                label="프로젝트 스케치 이미지 (선택)"
                currentUrl={
                  (
                    (block.data as {
                      projectSketch?: { imageUrl?: string };
                    }).projectSketch?.imageUrl ?? undefined
                  ) || null
                }
                currentLayout={
                  (block.data as {
                    projectSketch?: { imageLayout?: ImageLayout };
                  }).projectSketch?.imageLayout ?? null
                }
                disabled={pending || disabled}
              />
            </div>
          ) : (
            <BlockImageSlot
              newsletterId={newsletterId}
              blockIndex={blockIndex}
              label="이미지 (선택)"
              currentUrl={
                ((block.data as { imageUrl?: string }).imageUrl ?? null) || null
              }
              currentLayout={
                (block.data as { imageLayout?: ImageLayout }).imageLayout ?? null
              }
              disabled={pending || disabled}
            />
          )}

          {/* Source URL editor — shows "원문 보기 →" link on the rendered
              email when admin sets a URL. Per-item for multi-item blocks,
              block-level for single-topic blocks. */}
          <SourceUrlEditor
            newsletterId={newsletterId}
            blockIndex={blockIndex}
            block={block}
            disabled={pending || disabled}
            onDone={onDone}
          />

          {/* Regenerate controls */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold">
              이 블록 수정
            </Label>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              기본은 <strong className="text-foreground">편집 모드</strong>입니다. 지시 내용이 가리키는 부분만 수정되고,
              나머지 본문은 그대로 유지됩니다. 전체를 처음부터 다시 쓰고 싶다면
              지시에 <code className="px-1 py-0.5 rounded bg-muted font-mono">&quot;아예 새롭게 생성해줘&quot;</code>
              또는 <code className="px-1 py-0.5 rounded bg-muted font-mono">&quot;전체 다시 써줘&quot;</code> 같이 명시하세요.
            </p>
            {block.type === "groundk_story" ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                이 블록은 관리자 레퍼런스 전용입니다. 아래 칸에 현장 자료를 붙여
                넣으면 Claude가 편집자 톤으로 다듬어 반영합니다.
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  id={`auto-${blockIndex}`}
                  type="checkbox"
                  checked={autoSearch}
                  onChange={(e) => setAutoSearch(e.target.checked)}
                  disabled={pending || disabled}
                  className="h-4 w-4 rounded border-border"
                />
                <Label
                  htmlFor={`auto-${blockIndex}`}
                  className="cursor-pointer text-xs"
                >
                  자동 생성 (Claude가 후보 기사 참조)
                </Label>
              </div>
            )}
            {block.type !== "groundk_story" && autoSearch && (
              <div>
                <Label className="text-xs">이 블록에서 사용할 기사 (선택)</Label>
                <div className="mt-1">
                  <ArticlePicker
                    value={forcedArticleIds}
                    onChange={setForcedArticleIds}
                    disabled={pending || disabled}
                    articleUsedBy={articleUsedBy}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  지정하면 이 기사들만 Claude에 전달합니다. 비워두면 카테고리·기간 기반 자동 선별로 동작합니다.
                </p>
              </div>
            )}
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={block.type === "groundk_story" ? 5 : 2}
              disabled={pending || disabled}
              placeholder={
                block.type === "groundk_story"
                  ? `예: Field Briefing은 "공항 T2 수하물 판독 15~20분 지연" 이슈. Project Sketch는 COS 패션쇼 (정릉동 브루탈리즘 공간, 40개 룩, 앰버서더+미디어+디너 동선 설계, 2026.03.25)`
                  : `예 (부분 수정): "제목만 더 짧게", "두 번째 문단의 수치를 삭제", "첫 문장만 좀 더 단정적으로"
예 (전체 재작성): "아예 새롭게 생성해줘 — 이번엔 ESG 주제로"`
              }
              className="text-xs"
            />
            {msg && (
              <div
                className={
                  msg.type === "success"
                    ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
                    : "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 whitespace-pre-wrap"
                }
              >
                {msg.text}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleRegenerate}
                disabled={pending || disabled}
              >
                {pending ? "수정 중..." : "이 블록 수정"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// GroundkStory part toggles — hide / show Field Briefing and Project Sketch
// independently. Server-side blocks hiding BOTH to keep the block meaningful.
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// SourceUrlEditor — per-block / per-item "원문 링크" input.
//
// Renders one URL field for single-topic blocks (tech_signal,
// theory_to_field, consolidated_insight) and N fields for multi-item
// blocks (news_briefing.items, event_radar.events). Saves on blur or
// Enter via setBlockSourceUrlAction. Skipped entirely for block types
// that don't carry a sourceUrl concept.
// ─────────────────────────────────────────────
type SourceUrlTarget =
  | { kind: "block"; current: string }
  | { kind: "item"; itemIndex: number; itemLabel: string; current: string };

function collectSourceUrlTargets(block: BlockInstance): SourceUrlTarget[] {
  const d = block.data as Record<string, unknown>;
  switch (block.type) {
    case "tech_signal":
    case "theory_to_field":
    case "consolidated_insight":
      return [
        { kind: "block", current: (d.sourceUrl as string | undefined) ?? "" },
      ];
    case "news_briefing": {
      const items =
        (d.items as Array<Record<string, unknown>> | undefined) ?? [];
      return items.map((it, i) => ({
        kind: "item" as const,
        itemIndex: i,
        itemLabel:
          ((it.title as string | undefined) ?? `항목 ${i + 1}`).slice(0, 40) +
          (((it.title as string | undefined) ?? "").length > 40 ? "…" : ""),
        current: (it.sourceUrl as string | undefined) ?? "",
      }));
    }
    case "event_radar": {
      const events =
        (d.events as Array<Record<string, unknown>> | undefined) ?? [];
      return events.map((ev, i) => ({
        kind: "item" as const,
        itemIndex: i,
        itemLabel:
          ((ev.title as string | undefined) ?? `행사 ${i + 1}`).slice(0, 40) +
          (((ev.title as string | undefined) ?? "").length > 40 ? "…" : ""),
        current: (ev.sourceUrl as string | undefined) ?? "",
      }));
    }
    default:
      return [];
  }
}

function SourceUrlEditor({
  newsletterId,
  blockIndex,
  block,
  disabled,
  onDone,
}: {
  newsletterId: string;
  blockIndex: number;
  block: BlockInstance;
  disabled: boolean;
  onDone: () => void;
}) {
  const targets = collectSourceUrlTargets(block);
  if (targets.length === 0) return null;

  return (
    <section className="space-y-2 rounded-md border border-border bg-background p-3">
      <Label className="text-xs font-semibold">원문 링크 (선택)</Label>
      <p className="text-[11px] text-muted-foreground">
        URL을 입력하면 발송본에 &quot;원문 보기 →&quot; 링크가 표시됩니다. 비우면
        링크가 렌더링되지 않습니다.
      </p>
      <div className="space-y-2">
        {targets.map((t, i) => (
          <SourceUrlRow
            key={`${t.kind}-${t.kind === "item" ? t.itemIndex : "block"}-${i}`}
            newsletterId={newsletterId}
            blockIndex={blockIndex}
            target={t}
            disabled={disabled}
            onDone={onDone}
          />
        ))}
      </div>
    </section>
  );
}

function SourceUrlRow({
  newsletterId,
  blockIndex,
  target,
  disabled,
  onDone,
}: {
  newsletterId: string;
  blockIndex: number;
  target: SourceUrlTarget;
  disabled: boolean;
  onDone: () => void;
}) {
  const [value, setValue] = React.useState(target.current);
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<
    | { type: "success" | "error"; text: string }
    | null
  >(null);

  React.useEffect(() => {
    setValue(target.current);
  }, [target.current]);

  const dirty = value.trim() !== target.current.trim();

  function save() {
    if (!dirty || pending || disabled) return;
    setMsg(null);
    startTransition(async () => {
      const res = await setBlockSourceUrlAction({
        newsletterId,
        blockIndex,
        itemIndex: target.kind === "item" ? target.itemIndex : undefined,
        url: value.trim() || null,
      });
      if (res.ok) {
        onDone();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  return (
    <div>
      {target.kind === "item" && (
        <div className="text-[11px] text-muted-foreground mb-1">
          {target.itemLabel}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          disabled={disabled || pending}
          placeholder="https://..."
          className="flex-1 text-xs"
        />
        {dirty && (
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={pending}
          >
            {pending ? "저장 중..." : "저장"}
          </Button>
        )}
      </div>
      {msg && msg.type === "error" && (
        <p className="mt-1 text-[11px] text-rose-700">{msg.text}</p>
      )}
    </div>
  );
}

function GroundkStoryVisibilityToggles({
  newsletterId,
  blockIndex,
  showFieldBriefing,
  showProjectSketch,
  disabled,
  onDone,
}: {
  newsletterId: string;
  blockIndex: number;
  showFieldBriefing: boolean;
  showProjectSketch: boolean;
  disabled: boolean;
  onDone: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);

  function toggle(
    part: "fieldBriefing" | "projectSketch",
    next: boolean
  ) {
    setMsg(null);
    startTransition(async () => {
      const res = await setGroundkStoryVisibilityAction({
        newsletterId,
        blockIndex,
        part,
        visible: next,
      });
      if (res.ok) {
        onDone();
      } else {
        setMsg(res.error);
      }
    });
  }

  return (
    <section className="rounded-md border border-border bg-background p-3 space-y-2">
      <Label className="text-xs font-semibold">표시할 파트</Label>
      <p className="text-[11px] text-muted-foreground">
        둘 중 한 파트만 포함하고 싶을 때 체크를 해제하세요. 해제된 파트는
        본문·미리보기에서 사라지지만 입력한 내용은 보존됩니다.
      </p>
      <div className="flex items-center gap-4 flex-wrap">
        <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={showFieldBriefing}
            onChange={(e) => toggle("fieldBriefing", e.target.checked)}
            disabled={pending || disabled}
            className="h-4 w-4 rounded border-border"
          />
          <span>현장 브리핑 (Field Briefing)</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={showProjectSketch}
            onChange={(e) => toggle("projectSketch", e.target.checked)}
            disabled={pending || disabled}
            className="h-4 w-4 rounded border-border"
          />
          <span>프로젝트 스케치 (Project Sketch)</span>
        </label>
      </div>
      {msg && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">
          {msg}
        </div>
      )}
    </section>
  );
}

function getBlockTitle(block: BlockInstance): string | null {
  const d = block.data as Record<string, unknown>;
  if (!d) return null;
  if (typeof d.title === "string") return d.title;
  if (typeof d.hook === "string") return d.hook.split("\n")[0];
  // news_briefing has items[]
  const items = d.items as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(items) && items[0] && typeof items[0].title === "string") {
    return items[0].title;
  }
  // in_out_comparison has inItem
  const inItem = d.inItem as Record<string, unknown> | undefined;
  if (inItem && typeof inItem.title === "string") return inItem.title;
  // consolidated_insight has parts[]
  const parts = d.parts as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(parts) && parts[0] && typeof parts[0].title === "string") {
    return parts[0].title as string;
  }
  return null;
}

// ─────────────────────────────────────────────
// Subject editor — inline-editable email subject line in the top bar
// ─────────────────────────────────────────────
function SubjectEditor({
  newsletterId,
  initialSubject,
  disabled,
}: {
  newsletterId: string;
  initialSubject: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(initialSubject);
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<
    | { type: "success" | "error"; text: string }
    | null
  >(null);

  // Re-sync when the incoming prop changes (e.g. after regenerate).
  React.useEffect(() => {
    setValue(initialSubject);
  }, [initialSubject]);

  const dirty = value.trim() !== initialSubject.trim();

  function save() {
    if (!dirty || pending || disabled) return;
    setMsg(null);
    startTransition(async () => {
      const res = await updateNewsletterSubjectAction(newsletterId, value);
      if (res.ok) {
        setMsg({ type: "success", text: res.message ?? "저장됨" });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      setValue(initialSubject);
      setMsg(null);
    }
  }

  return (
    <div className="px-8 pt-4 pb-0 bg-background">
      <div className="flex items-center gap-3 flex-wrap">
        <label
          htmlFor="email-subject"
          className="text-xs font-semibold text-muted-foreground shrink-0"
        >
          메일 제목
        </label>
        <Input
          id="email-subject"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          disabled={disabled || pending}
          placeholder="메일 받은편지함에 표시될 제목"
          className="flex-1 min-w-[260px] text-sm"
          maxLength={200}
        />
        {dirty && (
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={pending}
          >
            {pending ? "저장 중..." : "저장"}
          </Button>
        )}
        {msg && (
          <span
            className={
              msg.type === "success"
                ? "text-[11px] text-emerald-700"
                : "text-[11px] text-rose-700"
            }
          >
            {msg.text}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        수신자 메일 프리뷰에 보이는 줄입니다. Enter 또는 포커스 이동 시 저장됩니다.
      </p>
    </div>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
