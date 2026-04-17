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
} from "@/app/(admin)/newsletters/actions";
import {
  NEWSLETTER_STATUS_LABELS,
  BLOCK_LABELS,
  BLOCK_NEEDS_RESEARCH,
  type NewsletterRow,
  type BlockInstance,
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
}

export function DraftEditor({ newsletter, initialHtml, articleMeta }: Props) {
  const router = useRouter();
  const [mode, setMode] = React.useState<ViewMode>("desktop");
  const [tab, setTab] = React.useState<"preview" | "blocks" | "json">("preview");
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
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        각 블록의 참고 자료를 확인하고, 마음에 안 들면 이 블록만 다시 생성할 수 있습니다.
        추가 지시 칸에 자연어로 원하는 방향을 적어 주세요 (예: "2번 기사는 관련 없으니 빼줘",
        "분량을 절반으로 줄여줘", "Agentic AI 대신 Spatial Computing으로 바꿔줘").
      </p>
      {blocks.map((block, i) => (
        <BlockCard
          key={block.id + i}
          newsletterId={newsletterId}
          block={block}
          blockIndex={i}
          articleMeta={articleMeta}
          disabled={disabled}
          onDone={onDone}
        />
      ))}
    </div>
  );
}

interface BlockCardProps {
  newsletterId: string;
  block: BlockInstance;
  blockIndex: number;
  articleMeta: Record<string, ArticleMetaEntry>;
  disabled: boolean;
  onDone: () => void;
}

function BlockCard({
  newsletterId,
  block,
  blockIndex,
  articleMeta,
  disabled,
  onDone,
}: BlockCardProps) {
  const [instructions, setInstructions] = React.useState(
    block.instructions ?? ""
  );
  const [autoSearch, setAutoSearch] = React.useState(
    block.autoSearch ?? BLOCK_NEEDS_RESEARCH[block.type]
  );
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  const refIds = block.referencedArticleIds ?? [];

  function handleRegenerate() {
    setMsg(null);
    startTransition(async () => {
      const res = await regenerateBlockAction({
        newsletterId,
        blockIndex,
        instructions: instructions.trim() || null,
        autoSearch,
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

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition text-left"
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

          {/* Regenerate controls */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold">
              이 블록만 재생성
            </Label>
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
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              disabled={pending || disabled}
              placeholder={`예: "2번 기사는 관련 없으니 빼고 다시", "더 짧게 써줘", "금리 인하보단 ESG 얘기로"`}
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
                {pending ? "재생성 중..." : "이 블록만 재생성"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
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

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
