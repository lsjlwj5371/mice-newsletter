"use client";

import * as React from "react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ARTICLE_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type RssFeed,
} from "@/lib/validation/rss";
import {
  createRssFeedAction,
  updateRssFeedAction,
  type ActionResult,
} from "@/app/(admin)/rss/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed?: RssFeed | null;
}

export function RssFeedFormDialog({ open, onOpenChange, feed }: Props) {
  const isEdit = !!feed;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});

  React.useEffect(() => {
    if (open) {
      setError(null);
      setFieldErrors({});
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      let result: ActionResult;
      if (isEdit && feed) {
        result = await updateRssFeedAction(feed.id, formData);
      } else {
        result = await createRssFeedAction(formData);
      }

      if (result.ok) {
        onOpenChange(false);
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "RSS 피드 수정" : "RSS 피드 추가"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "피드 정보를 수정합니다."
              : "수집할 RSS 피드 URL과 카테고리를 등록합니다."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="name">피드 이름 *</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={feed?.name ?? ""}
              placeholder="예: 한국MICE협회 보도자료"
              autoFocus={!isEdit}
            />
            {fieldErrors.name?.[0] && (
              <p className="text-xs text-rose-600">{fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="url">RSS URL *</Label>
            <Input
              id="url"
              name="url"
              type="url"
              required
              defaultValue={feed?.url ?? ""}
              placeholder="https://example.com/rss.xml"
              className="font-mono text-xs"
            />
            {fieldErrors.url?.[0] && (
              <p className="text-xs text-rose-600">{fieldErrors.url[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="category">카테고리 *</Label>
            <Select
              id="category"
              name="category"
              defaultValue={feed?.category ?? "news"}
            >
              {ARTICLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              카테고리는 뉴스레터의 섹션과 일치합니다. 자세한 설명은 아래 참조.
            </p>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
            {ARTICLE_CATEGORIES.map((c) => (
              <div key={c}>
                <span className="font-semibold">{CATEGORY_LABELS[c]}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — {CATEGORY_DESCRIPTIONS[c]}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="active"
              name="active"
              type="checkbox"
              defaultChecked={feed?.active ?? true}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="active" className="cursor-pointer">
              활성 (체크 해제 시 수집에서 제외)
            </Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">메모 (선택)</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={feed?.notes ?? ""}
              placeholder="이 피드에 대한 메모"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "저장 중..." : isEdit ? "수정 저장" : "추가"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
