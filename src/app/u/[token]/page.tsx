import { createAdminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/tokens";
import { logAudit } from "@/lib/audit";
import { loadTemplateSettings } from "@/lib/template-settings";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * One-click unsubscribe landing page.
 *
 * Per the admin's request, clicking the link in an email immediately
 * marks the recipient as unsubscribed — no confirmation required.
 * Shows a simple Korean confirmation screen.
 *
 * Also handles Gmail's RFC 8058 List-Unsubscribe POST (which triggers
 * without visiting this page) via the separate POST route handler.
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

  // Look up the send row (for audit trail + recipient resolution)
  const { data: sendRow } = await supabase
    .from("sends")
    .select("id, recipient_email, recipient_id, newsletter_id")
    .eq("id", claims.sendId)
    .single();

  const email = sendRow?.recipient_email ?? claims.email;

  // Mark the recipient (if exists in our list) as unsubscribed.
  // We match by email so even test-send recipients who later became
  // real subscribers get the expected behavior.
  const { data: recipient } = await supabase
    .from("recipients")
    .select("id, email, status")
    .ilike("email", email)
    .maybeSingle();

  let alreadyUnsubscribed = false;

  if (recipient) {
    if (recipient.status === "unsubscribed") {
      alreadyUnsubscribed = true;
    } else {
      await supabase
        .from("recipients")
        .update({
          status: "unsubscribed",
          unsubscribed_at: new Date().toISOString(),
          unsubscribe_reason: "one_click_link",
        })
        .eq("id", recipient.id);

      await logAudit({
        adminId: null,
        action: "recipient.self_unsubscribe",
        entity: "recipient",
        entityId: recipient.id,
        metadata: {
          email,
          sendId: claims.sendId,
          newsletterId: sendRow?.newsletter_id ?? null,
        },
      });
    }
  }

  // Pull the live brand name from template settings so messaging uses
  // the current wordmark instead of a hardcoded legacy one.
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
        {already ? "이미 수신 거부된 이메일입니다" : "수신 거부 완료"}
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
          ? `${email} 은(는) 이미 수신 거부 처리된 상태입니다.`
          : `${email} 은(는) 이제 ${brand} 뉴스레터를 받지 않습니다.`}
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
