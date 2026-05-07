import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/tokens";
import { logAudit } from "@/lib/audit";
import { loadTemplateSettings } from "@/lib/template-settings";
import { enqueueRemoveRequest } from "@/lib/ncp-sync/queue";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * One-click unsubscribe landing page.
 *
 * 본 콘솔은 외부 사용자의 수신 거부를 NCP 동기화 큐로만 흘려보내고,
 * 실제 NCP 주소록 반영은 관리자가 수기로 처리한다. recipients 테이블은
 * 절대 변경하지 않는다.
 *
 * RFC 8058 List-Unsubscribe POST(메일함 UI 클릭으로 자동 호출되는 경로)는
 * `/api/unsubscribe/[token]/route.ts` 에서 처리한다.
 */
export default async function UnsubscribePage({ params }: Props) {
  const { token } = await params;
  const claims = verifyToken(token);

  if (!claims || claims.kind !== "u") {
    return renderErrorShell(
      "링크가 유효하지 않습니다.",
      "이미 만료되었거나 잘못된 해지 링크입니다. 원본 이메일에서 다시 시도해 주세요."
    );
  }

  const supabase = createAdminClient();

  // 감사 로그용으로 send 행 lookup (이메일 결정용으로도 사용)
  const { data: sendRow } = await supabase
    .from("sends")
    .select("id, recipient_email, recipient_id, newsletter_id")
    .eq("id", claims.sendId)
    .single();

  const email = sendRow?.recipient_email ?? claims.email;

  // NCP 동기화 큐에 제거 요청만 등록. recipients 는 건드리지 않음.
  const enq = await enqueueRemoveRequest(supabase, {
    email,
    sourceKind: "one_click_link",
    notes: `sendId=${claims.sendId}`,
  });
  const alreadyUnsubscribed = !enq.inserted && !enq.error;

  await logAudit({
    adminId: null,
    action: enq.inserted
      ? "ncp_sync.remove_request_queued"
      : "ncp_sync.remove_request_duplicate",
    entity: "ncp_sync_request",
    metadata: {
      email,
      source: "one_click_link",
      sendId: claims.sendId,
      newsletterId: sendRow?.newsletter_id ?? null,
    },
  });

  revalidatePath("/ncp-sync");

  // 라이브 brand name 은 템플릿 설정에서.
  const template = await loadTemplateSettings();
  const brand = (template.header.wordmark ?? "").trim() || "뉴스레터";

  return renderSuccessShell(email, alreadyUnsubscribed, brand);
}

// ─── UI helpers ────────────────────────────────

function shell(children: React.ReactNode) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f7f9fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
        fontFamily:
          "'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "white",
          borderRadius: 16,
          padding: "40px 32px",
          boxShadow: "0 2px 24px rgba(0,0,0,0.04)",
          textAlign: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function renderSuccessShell(email: string, already: boolean, brand: string) {
  return shell(
    <>
      <div style={{ fontSize: 48, marginBottom: 12 }}>
        {already ? "✉️" : "✓"}
      </div>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#1a1a2e",
          margin: "0 0 12px 0",
          letterSpacing: "-0.3px",
        }}
      >
        {already
          ? "이미 수신 거부 신청이 접수된 이메일입니다"
          : "수신 거부 신청이 접수되었습니다"}
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "#555",
          lineHeight: 1.7,
          margin: "0 0 20px 0",
        }}
      >
        {already
          ? `${email} 의 수신 거부 신청은 이미 접수되어 처리 대기 중입니다. 곧 ${brand} 뉴스레터 발송 대상에서 제외됩니다.`
          : `${email} 의 수신 거부 신청이 접수되었습니다. 관리자 확인 후 ${brand} 뉴스레터 발송 대상에서 제외됩니다.`}
      </p>
    </>
  );
}

function renderErrorShell(title: string, message: string) {
  return shell(
    <>
      <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#1a1a2e",
          margin: "0 0 12px 0",
        }}
      >
        {title}
      </h1>
      <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, margin: 0 }}>
        {message}
      </p>
    </>
  );
}
