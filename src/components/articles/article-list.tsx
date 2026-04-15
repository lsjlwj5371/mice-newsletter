"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ArticleDetailDialog } from "./article-detail-dialog";
import {
  ARTICLE_CATEGORIES,
  CATEGORY_LABELS,
  type Article,
} from "@/lib/validation/rss";

interface Props {
  articles: Article[];
  totalCount: number;
}

export function ArticleList({ articles, totalCount }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const currentSearch = params.get("q") ?? "";
  const currentCategory = params.get("category") ?? "all";
  const currentImportance = params.get("min_importance") ?? "all";

  const [searchValue, setSearchValue] = React.useState(currentSearch);
  const [selected, setSelected] = React.useState<Article | null>(null);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      if (searchValue !== currentSearch) {
        const next = new URLSearchParams(params.toString());
        if (searchValue) next.set("q", searchValue);
        else next.delete("q");
        router.replace(`/articles?${next.toString()}`);
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  function setQuery(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    router.replace(`/articles?${next.toString()}`);
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="제목·요약 검색"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={currentCategory}
          onChange={(e) => setQuery("category", e.target.value)}
          className="max-w-[200px]"
        >
          <option value="all">모든 카테고리</option>
          {ARTICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select
          value={currentImportance}
          onChange={(e) => setQuery("min_importance", e.target.value)}
          className="max-w-[160px]"
        >
          <option value="all">모든 중요도</option>
          <option value="5">5점만</option>
          <option value="4">4점 이상</option>
          <option value="3">3점 이상</option>
          <option value="2">2점 이상</option>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {articles.length === totalCount
            ? `총 ${totalCount}건`
            : `${articles.length} / ${totalCount}건`}
        </span>
      </div>

      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center">
          <p className="text-sm text-muted-foreground">
            조건에 해당하는 기사가 없습니다.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            RSS 피드를 등록한 뒤 <span className="font-medium">RSS 피드 → 지금 수집 실행</span>{" "}
            버튼을 눌러보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className="w-full text-left rounded-xl border border-border bg-background p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="muted">
                      {CATEGORY_LABELS[a.category]}
                    </Badge>
                    {a.importance && (
                      <Badge variant={importanceBadgeVariant(a.importance)}>
                        ★ {a.importance}
                      </Badge>
                    )}
                    {a.analysis_error && (
                      <Badge variant="bounced">분석 실패</Badge>
                    )}
                    {!a.analyzed_at && !a.analysis_error && (
                      <Badge variant="pending">분석 대기</Badge>
                    )}
                    {a.source && (
                      <span className="text-xs text-muted-foreground">
                        {a.source}
                      </span>
                    )}
                    {a.published_at && (
                      <span className="text-xs text-muted-foreground">
                        · {formatDate(a.published_at)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium leading-snug mb-1">
                    {a.title}
                  </h3>
                  {a.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {a.summary}
                    </p>
                  )}
                  {a.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {a.tags.slice(0, 5).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] text-muted-foreground"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <ArticleDetailDialog
        article={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function importanceBadgeVariant(score: number) {
  if (score >= 4) return "active" as const;
  if (score >= 3) return "pending" as const;
  return "muted" as const;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
