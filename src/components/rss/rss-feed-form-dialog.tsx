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
import {
  ARTICLE_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type ArticleCategory,
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
  const [selectedCategories, setSelectedCategories] = React.useState<
    ArticleCategory[]
  >([]);

  React.useEffect(() => {
    if (open) {
      setError(null);
      setFieldErrors({});
      setSelectedCategories(
        feed?.categories && feed.categories.length > 0
          ? feed.categories
          : ["news_briefing"]
      );
    }
  }, [open, feed]);

  function toggleCategory(cat: ArticleCategory) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (selectedCategories.length === 0) {
      setFieldErrors({ categories: ["카테고리를 최소 1개 선택하세요"] });
      return;
    }

    const formData = new FormData(e.currentTarget);
    // Serialize selected categories as JSON so the zod schema can parse it
    formData.set("categories", JSON.stringify(selectedCategories));

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

          <div className="space-y-2">
            <Label>카테고리 * (복수 선택 가능)</Label>
            <div className="space-y-1.5">
              {ARTICLE_CATEGORIES.map((c) => {
                const checked = selectedCategories.includes(c);
                return (
                  <label
                    key={c}
                    className={`flex items-start gap-2 rounded-md border p-2.5 cursor-pointer transition ${
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(c)}
                      className="mt-0.5 h-4 w-4 rounded border-border shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {CATEGORY_LABELS[c]}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {CATEGORY_DESCRIPTIONS[c]}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
            {fieldErrors.categories?.[0] && (
              <p className="text-xs text-rose-600">
                {fieldErrors.categories[0]}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              하나의 피드가 여러 섹션에 쓰일 수 있을 때 복수 선택하세요. 이
              피드에서 수집된 기사는 선택된 모든 카테고리의 블록에서 후보가
              됩니다.
            </p>
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
