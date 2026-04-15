"use client";

import * as React from "react";
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
import { RssFeedFormDialog } from "./rss-feed-form-dialog";
import { CATEGORY_LABELS, type RssFeed } from "@/lib/validation/rss";
import { deleteRssFeedAction } from "@/app/(admin)/rss/actions";

interface Props {
  feeds: RssFeed[];
}

export function RssFeedTable({ feeds }: Props) {
  const [editing, setEditing] = React.useState<RssFeed | null>(null);
  const [deleting, setDeleting] = React.useState<RssFeed | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  function handleDelete() {
    if (!deleting) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteRssFeedAction(deleting.id);
      if (res.ok) {
        setDeleting(null);
      } else {
        setDeleteError(res.error);
      }
    });
  }

  if (feeds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center">
        <p className="text-sm text-muted-foreground">
          등록된 RSS 피드가 없습니다.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          우측 상단의 <span className="font-medium">+ 피드 추가</span> 버튼으로
          첫 피드를 등록하세요.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left">
              <Th>이름</Th>
              <Th>카테고리</Th>
              <Th>URL</Th>
              <Th>상태</Th>
              <Th>마지막 수집</Th>
              <Th className="text-right pr-4">작업</Th>
            </tr>
          </thead>
          <tbody>
            {feeds.map((f) => (
              <tr
                key={f.id}
                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <Td>
                  <div className="font-medium">{f.name}</div>
                  {f.notes && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {f.notes}
                    </div>
                  )}
                </Td>
                <Td>
                  <Badge variant="muted">{CATEGORY_LABELS[f.category]}</Badge>
                </Td>
                <Td>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-blue-600 hover:underline"
                  >
                    {f.url.length > 50 ? f.url.slice(0, 50) + "…" : f.url}
                  </a>
                </Td>
                <Td>
                  {f.active ? (
                    <Badge variant="active">활성</Badge>
                  ) : (
                    <Badge variant="muted">비활성</Badge>
                  )}
                </Td>
                <Td>
                  {f.last_error ? (
                    <div>
                      <Badge variant="bounced">실패</Badge>
                      <div
                        className="mt-1 text-xs text-rose-600 max-w-xs truncate"
                        title={f.last_error}
                      >
                        {f.last_error}
                      </div>
                    </div>
                  ) : f.last_fetched_at ? (
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(f.last_fetched_at)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </Td>
                <Td className="text-right pr-4">
                  <div className="inline-flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(f)}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleting(f)}
                    >
                      삭제
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RssFeedFormDialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        feed={editing}
      />

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>RSS 피드 삭제</DialogTitle>
          <DialogDescription>
            이 피드는 더 이상 수집되지 않습니다. 이미 수집된 기사는 그대로
            남습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {deleting && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{deleting.name}</div>
              <div className="font-mono text-xs text-muted-foreground mt-1">
                {deleting.url}
              </div>
            </div>
          )}
          {deleteError && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {deleteError}
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
            {pending ? "삭제 중..." : "삭제"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-xs font-medium text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffD = Math.round(diffHr / 24);
  if (diffD < 7) return `${diffD}일 전`;
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
