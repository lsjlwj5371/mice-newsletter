"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import {
  sendTestEmailAction,
  markNewsletterSentAction,
  resendNewsletterAction,
  cancelScheduledSendAction,
  type ResendAudience,
} from "@/app/(admin)/newsletters/send-actions";
import { Select } from "@/components/ui/select";
import type { NewsletterStatus } from "@/types/newsletter";

interface Props {
  newsletterId: string;
  status: NewsletterStatus;
  activeRecipientCount: number;
  /** ISO timestamp of the currently scheduled send, if any. */
  scheduledAt: string | null;
}

export function SendPanel({
  newsletterId,
  status,
  activeRecipientCount,
  scheduledAt,
}: Props) {
  const router = useRouter();
  const [testEmails, setTestEmails] = React.useState("");
  const [testPending, startTest] = React.useTransition();
  const [massPending, startMass] = React.useTransition();
  const [resendPending, startResend] = React.useTransition();
  const [schedulePending, startSchedule] = React.useTransition();
  const [resendAudience, setResendAudience] =
    React.useState<ResendAudience>("non_openers");
  const [resendEmails, setResendEmails] = React.useState("");
  const [msg, setMsg] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function handleTest() {
    const trimmed = testEmails.trim();
    if (!trimmed) {
      setMsg({ type: "error", text: "발송할 이메일을 입력해 주세요." });
      return;
    }
    setMsg(null);
    startTest(async () => {
      const res = await sendTestEmailAction({
        newsletterId,
        emails: trimmed,
      });
      if (res.ok) {
        setMsg({ type: "success", text: res.message ?? "테스트 발송 완료" });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  function handleMarkSent() {
    const confirmMsg =
      "이 호를 발송 완료 상태로 표시합니다.\n\n" +
      "수신자에게 이메일은 발송되지 않습니다 (실제 발송은 NCP 동기화 등 외부 채널로 진행). " +
      "이 호의 인용 기사는 사용 완료로 마킹되어 다음 호 후보에서 제외됩니다.\n\n계속할까요?";
    if (!confirm(confirmMsg)) return;
    setMsg(null);
    startMass(async () => {
      const res = await markNewsletterSentAction(newsletterId);
      if (res.ok) {
        setMsg({ type: "success", text: res.message ?? "발송 완료 처리됨" });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  function handleCancelSchedule() {
    if (!confirm("예약을 취소하고 초안 상태로 되돌릴까요?")) return;
    setMsg(null);
    startSchedule(async () => {
      const res = await cancelScheduledSendAction(newsletterId);
      if (res.ok) {
        setMsg({ type: "success", text: res.message ?? "예약이 취소되었습니다." });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  function handleResend() {
    const labelMap: Record<ResendAudience, string> = {
      non_openers: "미오픈자에게",
      failed: "발송 실패 수신자에게",
      specific: "입력한 이메일 주소로",
    };
    if (
      resendAudience === "specific" &&
      resendEmails.trim().length === 0
    ) {
      setMsg({ type: "error", text: "대상 이메일을 입력해 주세요." });
      return;
    }
    if (!confirm(`${labelMap[resendAudience]} 재발송합니다. 계속할까요?`)) return;
    setMsg(null);
    startResend(async () => {
      const res = await resendNewsletterAction({
        newsletterId,
        audience: resendAudience,
        emails: resendAudience === "specific" ? resendEmails : undefined,
      });
      if (res.ok) {
        setMsg({ type: "success", text: res.message ?? "재발송 완료" });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  const alreadySent = status === "sent";
  const isScheduled = status === "scheduled" && !!scheduledAt;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
        💡 먼저 본인 이메일로 <strong>테스트 발송</strong> 해서 실제 이메일
        클라이언트에서 어떻게 보이는지 확인한 뒤 발송 완료 처리하는 것을
        권장합니다. 실제 수신자 발송은 NCP 동기화로 별도 진행됩니다.
      </div>

      {/* Test send */}
      <section className="rounded-xl border border-border bg-background p-4 space-y-3">
        <div>
          <Label className="text-sm font-semibold">테스트 발송</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            아래 이메일 주소(들)로 즉시 발송합니다. 쉼표나 줄바꿈으로 여러 개 입력
            가능합니다.
          </p>
        </div>
        <Textarea
          value={testEmails}
          onChange={(e) => setTestEmails(e.target.value)}
          rows={2}
          placeholder={`예: groundk21@gmail.com, myemail@example.com`}
          className="text-sm"
          disabled={testPending || massPending}
        />
        <Button
          onClick={handleTest}
          disabled={testPending || massPending}
          size="sm"
        >
          {testPending ? "발송 중..." : "테스트 발송"}
        </Button>
      </section>

      {/* Scheduled state banner */}
      {isScheduled && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <div>
            <Label className="text-sm font-semibold text-emerald-900">
              예약 발송됨
            </Label>
            <p className="text-xs text-emerald-800 mt-0.5">
              {new Date(scheduledAt!).toLocaleString("ko-KR")} 에 활성 수신자{" "}
              {activeRecipientCount}명에게 자동으로 발송됩니다.
            </p>
            <p className="text-[11px] text-emerald-700 mt-1">
              실제 발송 시각은 예약 시각에서 최대 24시간 늦을 수 있습니다
              (Vercel Hobby 플랜의 cron이 하루 1회 실행되기 때문).
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-700"
            onClick={handleCancelSchedule}
            disabled={schedulePending}
          >
            {schedulePending ? "취소 중..." : "예약 취소"}
          </Button>
        </section>
      )}

      {/* 발송 완료 처리 — 상태값만 sent 로 전환 (실제 수신자 발송 없음).
          실제 발송은 NCP 동기화 등 외부 채널로 분리되어 있어, 이 admin
          도구에서는 호의 트래킹(상태/사용 기사 마킹)만 담당. */}
      <section className="rounded-xl border border-border bg-background p-4 space-y-3">
        <div>
          <Label className="text-sm font-semibold">발송 완료 처리</Label>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            이 호의 상태를 <strong className="text-foreground">발송 완료</strong>로
            표시합니다. 수신자에게 이메일이 발송되지는 않습니다 (실제 발송은 NCP
            동기화 등 외부 채널로 진행). 인용된 기사는 사용 완료로 마킹되어 다음
            호 후보에서 빠집니다.
          </p>
        </div>
        {alreadySent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            이 호는 이미 발송 완료 상태입니다.
          </div>
        ) : (
          <Button
            onClick={handleMarkSent}
            disabled={testPending || massPending}
          >
            {massPending ? "처리 중..." : "발송 완료 처리"}
          </Button>
        )}
      </section>

      {/* Resend — visible only once the newsletter has been sent at least once */}
      {alreadySent && (
        <section className="rounded-xl border border-border bg-background p-4 space-y-3">
          <div>
            <Label className="text-sm font-semibold">재발송</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              이미 발송된 호를 특정 대상에게 다시 보냅니다.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resend-audience" className="text-xs">
              대상
            </Label>
            <Select
              id="resend-audience"
              value={resendAudience}
              onChange={(e) =>
                setResendAudience(e.target.value as ResendAudience)
              }
              disabled={resendPending}
              className="max-w-xs"
            >
              <option value="non_openers">
                열어보지 않은 수신자에게만
              </option>
              <option value="failed">발송 실패한 수신자에게만</option>
              <option value="specific">특정 이메일 주소로</option>
            </Select>
          </div>

          {resendAudience === "specific" && (
            <Textarea
              value={resendEmails}
              onChange={(e) => setResendEmails(e.target.value)}
              rows={2}
              placeholder="groundk21@gmail.com, person2@example.com"
              className="text-sm"
              disabled={resendPending}
            />
          )}

          <Button onClick={handleResend} disabled={resendPending}>
            {resendPending ? "재발송 중..." : "재발송"}
          </Button>
        </section>
      )}

      {msg && (
        <div
          className={
            msg.type === "success"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 whitespace-pre-wrap"
              : "rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-wrap"
          }
        >
          {msg.text}
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1.5">
        <div className="font-semibold text-foreground">자동 처리되는 것들</div>
        <div>
          · 이메일에 <strong>한 번 클릭으로 수신 거부</strong> 링크 자동 삽입
        </div>
        <div>
          · Gmail/Outlook 상단의 "구독 해지" 버튼 지원 (List-Unsubscribe 헤더)
        </div>
        <div>
          · 이미 수신 거부된 사람은 발송에서 자동 제외
        </div>
        <div>
          · 발송 한도 초과·네트워크 오류 시 1분 후 자동 재시도
        </div>
      </div>
    </div>
  );
}

