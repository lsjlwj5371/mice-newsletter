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
import { RecipientFormDialog } from "./recipient-form-dialog";
import {
  STATUS_LABELS,
  SOURCE_LABELS,
  type Recipient,
} from "@/lib/validation/recipient";
import {
  deleteRecipientAction,
  generateReferralUrlAction,
} from "@/app/(admin)/recipients/actions";

interface Props {
  recipients: Recipient[];
}

const STATUS_BADGE_VARIANT = {
  active: "active" as const,
  unsubscribed: "unsubscribed" as const,
  pending: "pending" as const,
  bounced: "bounced" as const,
};

export function RecipientTable({ recipients }: Props) {
  const [editing, setEditing] = React.useState<Recipient | null>(null);
  const [deleting, setDeleting] = React.useState<Recipient | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [referralPendingId, setReferralPendingId] = React.useState<
    string | null
  >(null);
  const [referralToast, setReferralToast] = React.useState<string | null>(
    null
  );

  async function handleCopyReferral(recipientId: string) {
    setReferralPendingId(recipientId);
    setReferralToast(null);
    try {
      const res = await generateReferralUrlAction(recipientId);
      if (!res.ok || !res.url) {
        setReferralToast(`오류: ${!res.ok ? res.error : "URL 생성 실패"}`);
        return;
      }
      try {
        await navigator.clipboard.writeText(res.url);
        setReferralToast("추천 링크를 클립보드에 복사했습니다!");
      } catch {
        // Fallback: show link in toast so user can select manually
        setReferralToast(`복사 실패 — 링크: ${res.url}`);
      }
    } finally {
      setReferralPendingId(null);
      setTimeout(() => setReferralToast(null), 4000);
    }
  }

  function handleDelete() {
    if (!deleting) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteRecipientAction(deleting.id);
      if (res.ok) {
        setDeleting(null);
      } else {
        setDeleteError(res.error);
      }
    });
  }

  if (recipients.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center">
        <p className="text-sm text-muted-foreground">
          조건에 해당하는 수신자가 없습니다.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          우측 상단의 <span className="font-medium">+ 수신자 추가</span> 버튼으로
          새 수신자를 등록하세요.
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
              <Th>이메일</Th>
              <Th>이름</Th>
              <Th>조직</Th>
              <Th>직책 / 직무</Th>
              <Th>상태</Th>
              <Th>소스</Th>
              <Th>등록일</Th>
              <Th className="text-right pr-4">작업</Th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <Td>
                  <span className="font-mono text-xs">{r.email}</span>
                </Td>
                <Td>{r.name || <span className="text-muted-foreground">—</span>}</Td>
                <Td>
                  {r.organization || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Td>
                <Td>
                  <div className="text-xs">
                    <div>{r.position || "—"}</div>
                    <div className="text-muted-foreground">
                      {r.job_function || "—"}
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge variant={STATUS_BADGE_VARIANT[r.status]}>
                    {STATUS_LABELS[r.status]}
                  </Badge>
                </Td>
                <Td>
                  <Badge variant="muted">{SOURCE_LABELS[r.source]}</Badge>
                </Td>
                <Td>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(r.created_at)}
                  </span>
                </Td>
                <Td className="text-right pr-4">
                  <div className="inline-flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyReferral(r.id)}
                      disabled={referralPendingId === r.id}
                      title="이 수신자의 추천 링크 복사"
                    >
                      {referralPendingId === r.id ? "..." : "추천 링크"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(r)}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleting(r)}
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

      {/* Referral copy toast */}
      {referralToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-border bg-background shadow-lg px-4 py-3 text-sm max-w-sm animate-in fade-in">
          {referralToast}
        </div>
      )}

      {/* Edit dialog */}
      <RecipientFormDialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        recipient={editing}
      />

      {/* Delete confirmation dialog */}
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
          <DialogTitle>수신자 삭제</DialogTitle>
          <DialogDescription>
            이 작업은 되돌릴 수 없습니다. 발송 이력에서도 이 수신자에 대한
            기록이 사라질 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {deleting && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-mono text-xs">{deleting.email}</div>
              {deleting.name && (
                <div className="mt-1 text-muted-foreground">{deleting.name}</div>
              )}
            </div>
          )}
          {deleteError && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {deleteError}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            💡 단순히 발송에서 제외하고 싶으시면 삭제 대신{" "}
            <span className="font-medium">상태를 "수신 거부"로 변경</span>
            하시는 것이 안전합니다.
          </p>
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
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
