"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  NEWSLETTER_STATUS_LABELS,
  type NewsletterRow,
  type NewsletterStatus,
} from "@/types/newsletter";
import { deleteNewsletterAction } from "@/app/(admin)/newsletters/actions";

interface Props {
  newsletters: NewsletterRow[];
}

const STATUS_BADGE: Record<NewsletterStatus, "active" | "pending" | "muted" | "bounced" | "default"> = {
  draft: "pending",
  review: "pending",
  scheduled: "active",
  sent: "muted",
  archived: "muted",
};

export function NewsletterList({ newsletters }: Props) {
  const [deleting, setDeleting] = React.useState<NewsletterRow | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleDelete() {
    if (!deleting) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteNewsletterAction(deleting.id);
      if (res.ok) {
        setDeleting(null);
      } else {
        setError(res.error);
      }
    });
  }

  if (newsletters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center">
        <p className="text-sm text-muted-foreground">아직 작성된 호가 없습니다.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          우측 상단의 <span className="font-medium">+ 새 호 만들기</span> 버튼으로
          첫 호를 생성하세요. Claude가 후보 기사 + 사전 레퍼런스로 11개 섹션 초안을
          자동 작성합니다.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {newsletters.map((n) => (
          <div
            key={n.id}
            className="rounded-xl border border-border bg-background p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <Badge variant={STATUS_BADGE[n.status]}>
                    {NEWSLETTER_STATUS_LABELS[n.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    schema v{n.schema_version}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {n.used_article_ids.length}건 기사 사용
                  </span>
                </div>
                <Link
                  href={`/newsletters/${n.id}` as never}
                  className="block group"
                >
                  <h3 className="text-base font-semibold leading-snug group-hover:underline">
                    {n.issue_label}
                  </h3>
                  {n.subject && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                      {n.subject}
                    </p>
                  )}
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">
                  생성: {formatDateTime(n.created_at)}
                  {n.updated_at !== n.created_at &&
                    ` · 수정: ${formatDateTime(n.updated_at)}`}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Link href={`/newsletters/${n.id}` as never}>
                  <Button size="sm" variant="outline">
                    열기
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50"
                  onClick={() => setDeleting(n)}
                >
                  삭제
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setError(null);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>호 삭제</DialogTitle>
          <DialogDescription>
            이 작업은 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {deleting && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{deleting.issue_label}</div>
              {deleting.subject && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {deleting.subject}
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setDeleting(null)}
            disabled={pending}
          >
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? "삭제 중..." : "영구 삭제"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
