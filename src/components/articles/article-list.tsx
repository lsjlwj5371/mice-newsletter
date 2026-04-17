"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ArticleDetailDialog } from "./article-detail-dialog";
import {
  ARTICLE_CATEGORIES,
  CATEGORY_LABELS,
  type Article,
} from "@/lib/validation/rss";
import {
  setArticleStatusAction,
  toggleArticlePinAction,
} from "@/app/(admin)/articles/actions";

interface Counts {
  all: number;
  new: number;
  pinned: number;
  used: number;
  archived: number;
}

interface Props {
  articles: Article[];
  totalCount: number;
  currentView: string;
  counts: Counts;
}

const VIEW_TABS: Array<{ value: string; label: string; key: keyof Counts }> = [
  { value: "new", label: "검토 대기", key: "new" },
  { value: "pinned", label: "다음 호 예약", key: "pinned" },
  { value: "used", label: "사용 완료", key: "used" },
  { value: "archived", label: "불필요", key: "archived" },
  { value: "all", label: "전체", key: "all" },
];

export function ArticleList({ articles, counts, currentView }: Props) {
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

  function switchView(view: string) {
    const next = new URLSearchParams(params.toString());
    next.set("view", view);
    router.replace(`/articles?${next.toString()}`);
  }

  return (
    <>
      {/* Status tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-background p-1 overflow-x-auto">
        {VIEW_TABS.map((tab) => {
          const active = currentView === tab.value;
          const count = counts[tab.key];
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => switchView(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted text-foreground"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[20px] px-1.5 rounded-full text-[10px]",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
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
          {articles.length}건 표시
        </span>
      </div>

      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center">
          <p className="text-sm text-muted-foreground">
            조건에 해당하는 기사가 없습니다.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            다른 탭을 확인하거나, RSS 피드 메뉴에서 <span className="font-medium">지금 수집 실행</span> 을 눌러 새 기사를 가져오세요.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => (
            <ArticleRow
              key={a.id}
              article={a}
              currentView={currentView}
              onOpen={() => setSelected(a)}
            />
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

function ArticleRow({
  article,
  currentView,
  onOpen,
}: {
  article: Article;
  currentView: string;
  onOpen: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const isUsed = !!article.used_in_newsletter_id;

  function handlePin(next: boolean) {
    startTransition(async () => {
      await toggleArticlePinAction(article.id, next);
      router.refresh();
    });
  }

  function handleSetStatus(s: "new" | "archived") {
    startTransition(async () => {
      await setArticleStatusAction(article.id, s);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4 hover:bg-muted/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onOpen}
            className="w-full text-left"
          >
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {(article.categories ?? []).map((c) => (
                <Badge key={c} variant="muted">
                  {CATEGORY_LABELS[c]}
                </Badge>
              ))}
              {article.importance && (
                <Badge variant={importanceBadgeVariant(article.importance)}>
                  ★ {article.importance}
                </Badge>
              )}
              {article.pinned && <Badge variant="active">📌 다음 호</Badge>}
              {isUsed && <Badge variant="muted">사용됨</Badge>}
              {article.review_status === "archived" && (
                <Badge variant="bounced">불필요</Badge>
              )}
              {article.analysis_error && (
                <Badge variant="bounced">분석 실패</Badge>
              )}
              {!article.analyzed_at && !article.analysis_error && (
                <Badge variant="pending">분석 대기</Badge>
              )}
              {article.source && (
                <span className="text-xs text-muted-foreground">
                  {article.source}
                </span>
              )}
              {article.published_at && (
                <span className="text-xs text-muted-foreground">
                  · {formatDate(article.published_at)}
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium leading-snug mb-1">
              {article.title}
            </h3>
            {article.summary && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {article.summary}
              </p>
            )}
            {article.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {article.tags.slice(0, 5).map((t) => (
                  <span key={t} className="text-[10px] text-muted-foreground">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </button>
        </div>

        {/* Row actions */}
        {!isUsed && (
          <div className="flex flex-col gap-1 shrink-0">
            {article.review_status !== "archived" && (
              <Button
                size="sm"
                variant={article.pinned ? "primary" : "outline"}
                onClick={() => handlePin(!article.pinned)}
                disabled={pending}
                title={
                  article.pinned
                    ? "예약 해제"
                    : "다음 호에서 반드시 사용"
                }
              >
                {article.pinned ? "📌 예약됨" : "📌 다음 호"}
              </Button>
            )}
            {article.review_status === "new" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSetStatus("archived")}
                disabled={pending}
                className="text-rose-600"
              >
                불필요
              </Button>
            )}
            {article.review_status === "archived" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSetStatus("new")}
                disabled={pending}
              >
                되돌리기
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
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
