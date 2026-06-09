"use client";

/**
 * special_article 블록 전용 편집 패널.
 *
 * 기존 블록들이 paragraphs:string[] 평탄 배열에 imageUrl 한 개를 박는
 * 구조라 BlockImageSlot 한 개 + textarea 한 개로 충분했지만, special_article
 * 은 본문 자체가 ContentItem 자유 순서 배열이라 별도 에디터가 필요하다.
 *
 * 디자인:
 *   - 로컬 state 로 items 배열을 들고 있다가 사용자가 "저장" 누르면
 *     saveSpecialArticleItemsAction 으로 한 번에 persist.
 *   - 이미지 item 은 인라인 업로드 (POST /api/uploads/image) → 응답 URL 을
 *     해당 item.imageUrl 에 박는다.
 *   - 위/아래 화살표로 순서 변경 + ✕ 로 삭제. 드래그앤드롭은 일단 생략
 *     (mobile/Outlook 안정성 우선).
 *   - 추가 버튼: + 단락 / + 소제목 / + 인용구 / + 이미지 / + 구분선.
 *
 * eyebrow / title / subtitle / closingNote / sourceUrl 같은 메타 필드는
 * 이 컴포넌트와 별도로 raw JSON 편집기에서 다룬다 (전체 블록 재생성 or
 * 메타 필드만 따로 수정하는 경우엔 기존 본문 JSON 탭 활용).
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea, Input } from "@/components/ui/input";
import {
  SPECIAL_ARTICLE_IMAGE_LAYOUT_LABELS,
  SPECIAL_ARTICLE_IMAGE_LAYOUTS,
  type SpecialArticleItem,
} from "@/types/newsletter";
import { saveSpecialArticleItemsAction } from "@/app/(admin)/newsletters/actions";

interface Props {
  newsletterId: string;
  blockIndex: number;
  initialItems: SpecialArticleItem[];
  disabled?: boolean;
  onDone?: () => void;
}

export function SpecialArticleEditor({
  newsletterId,
  blockIndex,
  initialItems,
  disabled = false,
  onDone,
}: Props) {
  const [items, setItems] = React.useState<SpecialArticleItem[]>(
    () => initialItems ?? []
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  // 원본과 다르면 dirty — "저장하지 않은 변경사항" 표시.
  const dirty = React.useMemo(
    () => JSON.stringify(items) !== JSON.stringify(initialItems),
    [items, initialItems]
  );

  function update(index: number, patch: Partial<SpecialArticleItem>) {
    setItems((cur) => {
      const next = [...cur];
      next[index] = { ...next[index], ...patch } as SpecialArticleItem;
      return next;
    });
  }

  function remove(index: number) {
    setItems((cur) => cur.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    setItems((cur) => {
      const next = [...cur];
      const [m] = next.splice(index, 1);
      next.splice(target, 0, m);
      return next;
    });
  }

  function add(kind: SpecialArticleItem["kind"]) {
    let newItem: SpecialArticleItem;
    switch (kind) {
      case "paragraph":
        newItem = { kind: "paragraph", text: "" };
        break;
      case "heading":
        newItem = { kind: "heading", text: "", level: 2 };
        break;
      case "quote":
        newItem = { kind: "quote", text: "", attribution: "" };
        break;
      case "image":
        newItem = { kind: "image", imageUrl: "", caption: "", layout: "full" };
        break;
      case "divider":
        newItem = { kind: "divider" };
        break;
    }
    setItems((cur) => [...cur, newItem]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await saveSpecialArticleItemsAction({
        newsletterId,
        blockIndex,
        items,
      });
      if (!res.ok) {
        setError(res.error || "저장 실패");
      } else {
        setSavedAt(Date.now());
        onDone?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
        본문 콘텐츠를 자유롭게 배치하세요. 단락·소제목·인용구·이미지·구분선을
        원하는 순서대로 추가·이동·삭제할 수 있습니다.{" "}
        <strong className="text-foreground">
          이미지의 &quot;왼쪽/오른쪽&quot; 레이아웃은 바로 다음 단락과 짝지어
          나란히 표시
        </strong>
        됩니다 (1단락만 옆에 흐름). 짝이 없으면 작게·중앙으로 표시됩니다.
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            아직 콘텐츠가 없습니다. 아래 + 버튼으로 추가하세요.
          </div>
        ) : (
          items.map((item, i) => (
            <ItemRow
              key={i}
              index={i}
              total={items.length}
              item={item}
              disabled={disabled || saving}
              newsletterId={newsletterId}
              onUpdate={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
              onMove={(dir) => move(i, dir)}
            />
          ))
        )}
      </div>

      {/* 추가 버튼들 */}
      <div className="flex flex-wrap gap-2 pt-1">
        {(
          [
            { kind: "paragraph", label: "+ 단락" },
            { kind: "heading", label: "+ 소제목" },
            { kind: "quote", label: "+ 인용구" },
            { kind: "image", label: "+ 이미지" },
            { kind: "divider", label: "+ 구분선" },
          ] as const
        ).map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            onClick={() => add(kind)}
            disabled={disabled || saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border bg-background hover:bg-muted transition disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>

      {/* 저장 바 */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="text-[11px] text-muted-foreground">
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : dirty ? (
            <span className="text-amber-700">저장하지 않은 변경사항</span>
          ) : savedAt ? (
            <span>저장됨</span>
          ) : (
            <span>변경사항 없음</span>
          )}
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={disabled || saving || !dirty}
          size="sm"
        >
          {saving ? "저장 중…" : "본문 저장"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 행 — kind 별 분기
// ─────────────────────────────────────────────
function ItemRow({
  index,
  total,
  item,
  disabled,
  newsletterId,
  onUpdate,
  onRemove,
  onMove,
}: {
  index: number;
  total: number;
  item: SpecialArticleItem;
  disabled: boolean;
  newsletterId: string;
  onUpdate: (patch: Partial<SpecialArticleItem>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background">
      {/* 헤더 — kind 라벨 + 컨트롤 */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-2 py-1">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="text-[10px] text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span>{kindLabel(item.kind)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={disabled || index === 0}
            className="px-1.5 py-0.5 text-[11px] rounded hover:bg-muted disabled:opacity-30"
            title="위로"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={disabled || index === total - 1}
            className="px-1.5 py-0.5 text-[11px] rounded hover:bg-muted disabled:opacity-30"
            title="아래로"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="px-1.5 py-0.5 text-[11px] rounded text-red-600 hover:bg-red-50 disabled:opacity-30"
            title="삭제"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 본문 — kind 별 에디터 */}
      <div className="p-2">
        {item.kind === "paragraph" && (
          <Textarea
            value={item.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="단락 본문…"
            disabled={disabled}
            rows={3}
            className="text-sm"
          />
        )}

        {item.kind === "heading" && (
          <div className="space-y-2">
            <Input
              value={item.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              placeholder="소제목 (12~20자 권장)"
              disabled={disabled}
              className="text-sm font-semibold"
            />
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>크기:</span>
              {([2, 3] as const).map((lv) => (
                <label key={lv} className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name={`heading-level-${index}`}
                    checked={(item.level ?? 2) === lv}
                    onChange={() => onUpdate({ level: lv })}
                    disabled={disabled}
                    className="h-3 w-3"
                  />
                  <span>{lv === 2 ? "H2 (큰 소제목)" : "H3 (작은 소제목)"}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {item.kind === "quote" && (
          <div className="space-y-2">
            <Textarea
              value={item.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              placeholder="강조하고 싶은 한 문장…"
              disabled={disabled}
              rows={2}
              className="text-sm italic"
            />
            <Input
              value={item.attribution ?? ""}
              onChange={(e) => onUpdate({ attribution: e.target.value })}
              placeholder="출처 (선택) — 예: 김아무개 부장, 신라호텔 MICE팀"
              disabled={disabled}
              className="text-xs"
            />
          </div>
        )}

        {item.kind === "image" && (
          <ImageItemEditor
            item={item}
            disabled={disabled}
            newsletterId={newsletterId}
            onUpdate={(patch) =>
              onUpdate(patch as Partial<SpecialArticleItem>)
            }
          />
        )}

        {item.kind === "divider" && (
          <div className="text-center text-xs text-muted-foreground py-2">
            ◆ ◆ ◆ &nbsp;&nbsp; (구분선 — 별도 설정 없음)
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 이미지 item 전용 에디터 — 업로드 + caption + layout
// ─────────────────────────────────────────────
function ImageItemEditor({
  item,
  disabled,
  newsletterId,
  onUpdate,
}: {
  item: Extract<SpecialArticleItem, { kind: "image" }>;
  disabled: boolean;
  newsletterId: string;
  onUpdate: (patch: Partial<Extract<SpecialArticleItem, { kind: "image" }>>) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [uploadErr, setUploadErr] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("newsletterId", newsletterId);
      // 풀폭 케이스에서는 hero(1280px) 가 좋고, small-center/left/right 는
      // 일반(640px) 으로 충분. layout 에 따라 선택.
      if (item.layout === "full") {
        fd.append("variant", "hero");
      }
      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!res.ok || !json.url) {
        setUploadErr(json.error || `업로드 실패 (HTTP ${res.status})`);
        return;
      }
      onUpdate({ imageUrl: json.url });
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {/* 현재 이미지 프리뷰 + 업로드 트리거 */}
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-32 h-20 rounded border border-border bg-muted/30 overflow-hidden flex items-center justify-center"
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[10px] text-muted-foreground">미업로드</span>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            disabled={disabled || uploading}
            className="block w-full text-[11px] file:mr-2 file:px-2 file:py-1 file:rounded file:border file:border-border file:bg-background file:text-xs"
          />
          {uploading && (
            <span className="text-[10px] text-muted-foreground">업로드 중…</span>
          )}
          {uploadErr && (
            <span className="text-[10px] text-red-600">{uploadErr}</span>
          )}
          {item.imageUrl && (
            <button
              type="button"
              onClick={() => onUpdate({ imageUrl: "" })}
              disabled={disabled}
              className="text-[10px] text-red-600 hover:underline"
            >
              이미지 제거
            </button>
          )}
        </div>
      </div>

      {/* layout 선택 */}
      <div className="space-y-1">
        <Label className="text-[11px]">배치</Label>
        <div className="flex flex-wrap gap-2">
          {SPECIAL_ARTICLE_IMAGE_LAYOUTS.map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => onUpdate({ layout: lv })}
              disabled={disabled}
              className={`px-2 py-1 text-[11px] rounded border ${
                (item.layout ?? "full") === lv
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:bg-muted"
              } disabled:opacity-50`}
            >
              {SPECIAL_ARTICLE_IMAGE_LAYOUT_LABELS[lv]}
            </button>
          ))}
        </div>
        {(item.layout === "left" || item.layout === "right") && (
          <p className="text-[10px] text-muted-foreground">
            바로 다음 단락과 짝지어 나란히 표시됩니다. 짝이 없으면 작게·중앙으로
            폴백.
          </p>
        )}
      </div>

      {/* caption */}
      <Input
        value={item.caption ?? ""}
        onChange={(e) => onUpdate({ caption: e.target.value })}
        placeholder="캡션 (선택) — 이미지 아래에 작게 표시"
        disabled={disabled}
        className="text-xs"
      />
    </div>
  );
}

function kindLabel(kind: SpecialArticleItem["kind"]): string {
  switch (kind) {
    case "paragraph":
      return "단락";
    case "heading":
      return "소제목";
    case "quote":
      return "인용구";
    case "image":
      return "이미지";
    case "divider":
      return "구분선";
  }
}

