"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import {
  setBlockImageAction,
  setBlockImageLayoutAction,
} from "@/app/(admin)/newsletters/actions";
import {
  IMAGE_LAYOUTS,
  IMAGE_LAYOUT_LABELS,
  type ImageLayout,
} from "@/types/newsletter";

interface Props {
  newsletterId: string;
  blockIndex: number;
  /** Current image URL stored on the block (or sub-slot). */
  currentUrl?: string | null;
  /** Current layout mode. Defaults to "full" when absent. */
  currentLayout?: ImageLayout | null;
  /** For groundk_story: which sub-part this slot controls. */
  slot?: "fieldBriefing" | "projectSketch";
  /** For event_radar / news_briefing: which nested item this slot targets. */
  itemIndex?: number;
  /** For item-based blocks (event_radar / news_briefing), force-show the
   *  layout dropdown even though per-item slots normally hide it. Use
   *  this only when the renderer actually honors the layout (currently
   *  just event_radar's single-featured item). */
  allowItemLayout?: boolean;
  /** Upload variant. `"hero"` pre-crops to 2:1 (1280×640) for the MICE
   *  Insight full-bleed layout and hides the layout dropdown (hero
   *  images don't participate in left/right wrap modes). */
  variant?: "default" | "hero";
  /** Human-readable label shown above the widget. */
  label?: string;
  disabled?: boolean;
}

/**
 * Upload / preview / remove widget for a single image slot on a block.
 *  - Clicking the dashed area opens a file picker.
 *  - Selected file is sent to POST /api/uploads/image, which returns
 *    the processed URL.
 *  - Once uploaded, server action setBlockImageAction patches the
 *    newsletter's content_json so the image sticks across refreshes.
 *  - Remove button clears the image from the block.
 */
export function BlockImageSlot({
  newsletterId,
  blockIndex,
  currentUrl,
  currentLayout,
  slot,
  itemIndex,
  allowItemLayout,
  variant = "default",
  label = "이미지",
  disabled,
}: Props) {
  const isHero = variant === "hero";
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [layoutPending, startLayoutChange] = React.useTransition();

  function handleLayoutChange(layout: ImageLayout) {
    setError(null);
    startLayoutChange(async () => {
      const res = await setBlockImageLayoutAction({
        newsletterId,
        blockIndex,
        layout,
        slot,
        itemIndex,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("newsletterId", newsletterId);
      if (isHero) fd.append("variant", "hero");

      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: fd,
      });
      const body = await res.json();

      if (!res.ok || !body.ok) {
        setError(body.error ?? `업로드 실패 (HTTP ${res.status})`);
        return;
      }

      const actionRes = await setBlockImageAction({
        newsletterId,
        blockIndex,
        imageUrl: body.url,
        slot,
        itemIndex,
      });
      if (!actionRes.ok) {
        setError(actionRes.error);
        return;
      }
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`업로드 실패: ${msg}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!confirm("이 이미지를 제거할까요?")) return;
    setError(null);
    setUploading(true);
    try {
      const actionRes = await setBlockImageAction({
        newsletterId,
        blockIndex,
        imageUrl: null,
        slot,
        itemIndex,
      });
      if (!actionRes.ok) {
        setError(actionRes.error);
        return;
      }
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold">{label}</Label>
      {currentUrl ? (
        <div className="space-y-2">
          <div className="rounded-lg border border-border overflow-hidden bg-muted/20">
            <img
              src={currentUrl}
              alt=""
              className="block w-full max-h-64 object-contain"
            />
          </div>
          {/* Layout controls apply to block-level images by default.
              For item-based blocks (news_briefing items) they stay
              hidden because the card layout is fixed — but event_radar
              (single featured event) opts in via allowItemLayout.
              Hero slots always hide the dropdown: a full-bleed hero
              doesn't participate in left/right/small layouts. */}
          {!isHero && (itemIndex === undefined || allowItemLayout) && (
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs text-muted-foreground">배치</Label>
              <select
                value={currentLayout ?? "full"}
                onChange={(e) =>
                  handleLayoutChange(e.target.value as ImageLayout)
                }
                disabled={uploading || disabled || layoutPending}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              >
                {IMAGE_LAYOUTS.map((lay) => (
                  <option key={lay} value={lay}>
                    {IMAGE_LAYOUT_LABELS[lay]}
                  </option>
                ))}
              </select>
              {layoutPending && (
                <span className="text-[11px] text-muted-foreground">
                  적용 중...
                </span>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || disabled}
            >
              {uploading ? "업로드 중..." : "다른 이미지로 교체"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-rose-600"
              onClick={handleRemove}
              disabled={uploading || disabled}
            >
              제거
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || disabled}
          className="w-full rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center hover:bg-muted/40 transition disabled:opacity-50"
        >
          <div className="text-sm text-muted-foreground">
            {uploading ? (
              <>업로드 중…</>
            ) : (
              <>
                <div className="text-lg mb-1">📷</div>
                <div className="font-medium">이미지 업로드</div>
                <div className="text-xs mt-1">
                  PNG · JPEG · WebP · GIF (최대 10MB)
                </div>
                {isHero && (
                  <div className="text-[11px] mt-2 text-muted-foreground/80 leading-relaxed">
                    📐 풀 블리드 히어로 — 가로 사진 권장<br />
                    원본 비율 그대로 표시됩니다 (잘림 없음)
                  </div>
                )}
              </>
            )}
          </div>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFile}
        className="hidden"
      />
      {error && (
        <p className="text-xs text-rose-600 whitespace-pre-wrap">{error}</p>
      )}
    </div>
  );
}
