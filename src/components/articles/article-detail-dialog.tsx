"use client";

import * as React from "react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, type Article } from "@/lib/validation/rss";

interface Props {
  article: Article | null;
  onClose: () => void;
}

export function ArticleDetailDialog({ article, onClose }: Props) {
  return (
    <Dialog open={!!article} onOpenChange={(open) => !open && onClose()}>
      {article && (
        <>
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="muted">{CATEGORY_LABELS[article.category]}</Badge>
              {article.importance && (
                <Badge variant={importanceBadge(article.importance)}>
                  중요도 {article.importance}
                </Badge>
              )}
              {article.analysis_error && (
                <Badge variant="bounced">분석 실패</Badge>
              )}
            </div>
            <DialogTitle>{article.title}</DialogTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              {article.source && <span>{article.source} · </span>}
              {article.published_at && (
                <span>{formatDate(article.published_at)} · </span>
              )}
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                원문 보기 ↗
              </a>
            </div>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {article.summary && (
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">
                  Claude 요약
                </h3>
                <p className="text-sm leading-relaxed">{article.summary}</p>
              </section>
            )}

            {article.tags.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">
                  태그
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {article.tags.map((t) => (
                    <Badge key={t} variant="default">
                      {t}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {article.raw_excerpt && (
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">
                  원문 발췌
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3">
                  {article.raw_excerpt}
                </p>
              </section>
            )}

            {article.analysis_error && (
              <section>
                <h3 className="text-xs font-semibold text-rose-600 mb-1.5">
                  분석 오류
                </h3>
                <p className="text-xs text-rose-700 rounded-md border border-rose-200 bg-rose-50 p-3">
                  {article.analysis_error}
                </p>
              </section>
            )}

            <section className="text-xs text-muted-foreground">
              수집: {formatDateTime(article.collected_at)}
              {article.analyzed_at &&
                ` · 분석: ${formatDateTime(article.analyzed_at)}`}
            </section>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              닫기
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}

function importanceBadge(score: number) {
  if (score >= 4) return "active" as const;
  if (score >= 3) return "pending" as const;
  return "muted" as const;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
