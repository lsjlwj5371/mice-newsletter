"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  searchArticlesForPicker,
  type PickerArticle,
} from "@/app/(admin)/articles/actions";
import {
  ARTICLE_CATEGORIES,
  CATEGORY_LABELS,
} from "@/lib/validation/rss";

interface Props {
  /** Currently selected article IDs. */
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * Optional hint — when passed, the picker opens pre-filtered to this
   * category. Admin can clear it.
   */
  defaultCategory?: string;
  /**
   * Optional article IDs to exclude (e.g. articles already used by
   * OTHER blocks in the same newsletter).
   */
  excludeIds?: string[];
  disabled?: boolean;
  /** Trigger button label. Defaults to a simple "기사 선택". */
  triggerLabel?: string;
}

/**
 * Modal picker that lets an admin select specific articles to feed into
 * a block's candidate pool. Selection is multi-select; order is preserved
 * in insertion order.
 *
 * Keeps selected articles' metadata in local state so admins can see
 * their choices even after filtering changes hide some rows.
 */
export function ArticlePicker({
  value,
  onChange,
  defaultCategory,
  excludeIds,
  disabled,
  triggerLabel,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [articles, setArticles] = React.useState<PickerArticle[]>([]);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>(
    defaultCategory ?? "all"
  );
  /** Selected articles kept by ID so we can display them even after the
   *  list re-filters. Built up as the admin clicks. */
  const [picked, setPicked] = React.useState<Map<string, PickerArticle>>(
    new Map()
  );

  const excludeSet = React.useMemo(
    () => new Set(excludeIds ?? []),
    [excludeIds]
  );

  // Sync `picked` from incoming `value` on open
  React.useEffect(() => {
    if (!open) return;
    // Whatever we already have in picked is authoritative for rows we've
    // seen; rows in `value` that we haven't loaded will appear as ID-only
    // until the next search hit.
  }, [open]);

  async function runSearch() {
    setLoading(true);
    setError(null);
    const res = await searchArticlesForPicker({
      query: query.trim() || undefined,
      category: category === "all" ? undefined : category,
      limit: 80,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const filtered = res.articles.filter((a) => !excludeSet.has(a.id));
    setArticles(filtered);

    // Merge newly-loaded rows into the picked map (so selected rows render
    // properly even if they weren't previously loaded).
    setPicked((prev) => {
      const next = new Map(prev);
      for (const a of filtered) {
        if (value.includes(a.id) && !next.has(a.id)) {
          next.set(a.id, a);
        }
      }
      return next;
    });
  }

  // Initial fetch when opened
  React.useEffect(() => {
    if (open) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced re-search on filter change
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => runSearch(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  function toggle(article: PickerArticle, next: boolean) {
    const ids = new Set(value);
    if (next) ids.add(article.id);
    else ids.delete(article.id);

    setPicked((prev) => {
      const m = new Map(prev);
      if (next) m.set(article.id, article);
      // keep entry even when unchecked — simpler state; cheap
      return m;
    });

    // Preserve previous order; append newly-added to the end
    const nextList: string[] = [];
    for (const id of value) {
      if (ids.has(id)) nextList.push(id);
    }
    if (next && !value.includes(article.id)) nextList.push(article.id);
    onChange(nextList);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {triggerLabel ?? "이 블록에서 사용할 기사 선택"}
        {value.length > 0 && (
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] h-4 min-w-4 px-1">
            {value.length}
          </span>
        )}
      </Button>

      {/* Selected chips outside the modal so the admin always sees current pick */}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((id) => {
            const a = picked.get(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px]"
                title={a?.title ?? id}
              >
                <span className="max-w-[280px] truncate">
                  {a?.title ?? `${id.slice(0, 8)}…`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    onChange(value.filter((v) => v !== id));
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="해제"
                >
                  ✕
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            전체 해제
          </button>
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-3xl max-h-[88vh] bg-background rounded-xl border border-border shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div>
                <div className="text-sm font-semibold">기사 선택</div>
                <div className="text-xs text-muted-foreground">
                  이 블록에서 반드시 참고할 기사를 선택합니다. 다른 블록에서
                  이미 사용 중인 기사도 골라도 되지만, 가급적 중복은 피하는
                  것이 좋습니다.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground text-lg"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-3 border-b border-border flex gap-2 flex-wrap">
              <Input
                placeholder="제목·요약 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-[200px]"
              >
                <option value="all">모든 카테고리</option>
                {ARTICLE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
              <span className="text-xs text-muted-foreground self-center ml-auto">
                {value.length}건 선택됨
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
              {error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}
              {loading && articles.length === 0 && (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  불러오는 중…
                </div>
              )}
              {!loading && articles.length === 0 && !error && (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  조건에 해당하는 기사가 없습니다.
                </div>
              )}
              {articles.map((a) => {
                const isChecked = value.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-md border cursor-pointer transition",
                      isChecked
                        ? "border-primary/60 bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => toggle(a, e.target.checked)}
                      className="h-4 w-4 mt-1 rounded border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {(a.categories ?? []).map((c) => (
                          <Badge key={c} variant="muted">
                            {CATEGORY_LABELS[
                              c as keyof typeof CATEGORY_LABELS
                            ] ?? c}
                          </Badge>
                        ))}
                        {typeof a.importance === "number" && (
                          <Badge
                            variant={
                              a.importance >= 4
                                ? "active"
                                : a.importance >= 3
                                ? "pending"
                                : "muted"
                            }
                          >
                            ★ {a.importance}
                          </Badge>
                        )}
                        {a.pinned && <Badge variant="active">📌</Badge>}
                        {a.source && (
                          <span className="text-[11px] text-muted-foreground">
                            {a.source}
                          </span>
                        )}
                        {a.published_at && (
                          <span className="text-[11px] text-muted-foreground">
                            · {a.published_at.slice(0, 10)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium leading-snug line-clamp-2">
                        {a.title}
                      </div>
                      {a.summary && (
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {a.summary}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange([])}
                disabled={value.length === 0}
              >
                전체 해제
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setOpen(false)}
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
