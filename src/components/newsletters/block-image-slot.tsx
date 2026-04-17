"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { setBlockImageAction } from "@/app/(admin)/newsletters/actions";

interface Props {
  newsletterId: string;
  blockIndex: number;
  /** Current image URL stored on the block (or sub-slot). */
  currentUrl?: string | null;
  /** For groundk_story: which sub-part this slot controls. */
  slot?: "fieldBriefing" | "projectSketch";
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
  slot,
  label = "이미지",
  disabled,
}: Props) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("newsletterId", newsletterId);

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
