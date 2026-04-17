"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import {
  sendTestEmailAction,
  sendNewsletterAction,
  resendNewsletterAction,
  scheduleNewsletterAction,
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
  const [scheduleDate, setScheduleDate] = React.useState("");
  const [scheduleTime, setScheduleTime] = React.useState("09:00");
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

  function handleMassSend() {
    const confirmMsg = `활성 수신자 ${activeRecipientCount}명에게 발송합니다.\n\n이 작업은 취소할 수 없습니다. 정말 발송할까요?`;
    if (!confirm(confirmMsg)) return;
    setMsg(null);
    startMass(async () => {
      const res = await sendNewsletterAction(newsletterId);
      if (res.ok) {
        setMsg({ type: "success", text: res.message ?? "발송 완료" });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  function handleSchedule() {
    if (!scheduleDate || !scheduleTime) {
      setMsg({ type: "error", text: "날짜와 시각을 모두 선택해 주세요." });
      return;
    }
    // Combine into local datetime, then convert to ISO.
    const localIso = `${scheduleDate}T${scheduleTime}:00`;
    const d = new Date(localIso);
    if (Number.isNaN(d.getTime())) {
      setMsg({ type: "error", text: "예약 시각 형식이 잘못되었습니다." });
      return;
    }
    const confirmMsg = `${d.toLocaleString("ko-KR")}에 활성 수신자 ${activeRecipientCount}명에게 자동 발송됩니다.\n\n계속할까요?`;
    if (!confirm(confirmMsg)) return;
    setMsg(null);
    startSchedule(async () => {
      const res = await scheduleNewsletterAction({
        newsletterId,
        scheduledAt: d.toISOString(),
      });
      if (res.ok) {
        setMsg({ type: "success", text: res.message ?? "예약 완료" });
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

  // Default the date picker to tomorrow so the calendar isn't blank
  const tomorrow = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateForInput(d);
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
        💡 먼저 본인 이메일로 <strong>테스트 발송</strong> 해서 실제 이메일
        클라이언트에서 어떻게 보이는지 확인한 뒤 일괄 발송하는 것을 권장합니다.
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

      {/* Mass send */}
      <section className="rounded-xl border border-border bg-background p-4 space-y-3">
        <div>
          <Label className="text-sm font-semibold">정식 발송</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            현재 활성 상태인 수신자{" "}
            <span className="font-semibold text-foreground">
              {activeRecipientCount}명
            </span>
            에게 발송합니다.
          </p>
        </div>
        {alreadySent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            이 호는 이미 발송 완료되었습니다. 아래 <strong>재발송</strong> 섹션을
            사용하세요.
          </div>
        ) : activeRecipientCount === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            활성 수신자가 없습니다. <strong>수신자</strong> 메뉴에서 먼저 등록해
            주세요.
          </div>
        ) : (
          <Button
            onClick={handleMassSend}
            disabled={testPending || massPending}
          >
            {massPending
              ? "발송 중..."
              : `${activeRecipientCount}명에게 발송`}
          </Button>
        )}
      </section>

      {/* Schedule — visible when not yet sent or scheduled */}
      {!alreadySent && !isScheduled && activeRecipientCount > 0 && (
        <section className="rounded-xl border border-border bg-background p-4 space-y-3">
          <div>
            <Label className="text-sm font-semibold">예약 발송</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              즉시 발송 대신 특정 시각에 자동 발송하고 싶으면 여기서 설정하세요.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="space-y-1">
              <Label htmlFor="schedule-date" className="text-xs">
                날짜
              </Label>
              <Input
                id="schedule-date"
                type="date"
                min={tomorrow}
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                disabled={schedulePending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="schedule-time" className="text-xs">
                시각
              </Label>
              <Input
                id="schedule-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                disabled={schedulePending}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Vercel Hobby 플랜의 제약으로 예약 시각에서 최대 24시간 늦게 발송될 수
            있습니다. 정확한 시각 발송이 필요하면 "즉시 발송"을 사용하세요.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSchedule}
            disabled={
              schedulePending ||
              testPending ||
              massPending ||
              !scheduleDate ||
              !scheduleTime
            }
          >
            {schedulePending ? "설정 중..." : "예약 설정"}
          </Button>
        </section>
      )}

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

function formatDateForInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
