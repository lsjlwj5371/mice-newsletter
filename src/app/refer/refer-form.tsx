"use client";

import * as React from "react";
import {
  selfReferralSignupAction,
  type ReferralSignupResult,
} from "./actions";

interface Props {
  brand: string;
  tagline: string;
}

export function ReferForm({ brand, tagline }: Props) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<ReferralSignupResult | null>(
    null
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await selfReferralSignupAction(email, name);
      setResult(res);
    });
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {result && result.ok ? (
          <Success result={result} brand={brand} />
        ) : (
          <>
            <div style={{ fontSize: 42, marginBottom: 10 }}>✉️</div>
            <h1 style={styles.h1}>{brand} 구독 신청</h1>
            {tagline && <p style={styles.tagline}>{tagline}</p>}
            <p style={styles.desc}>
              아래에 이메일을 남겨주시면 다음 호부터 받아보실 수 있습니다.
            </p>
            <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
              <input
                type="text"
                placeholder="이름 (선택)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
                style={styles.input}
              />
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                style={styles.input}
              />
              <button type="submit" disabled={pending} style={styles.button}>
                {pending ? "처리 중…" : "구독 신청"}
              </button>
              {result && !result.ok && (
                <p style={styles.error}>{result.error}</p>
              )}
            </form>
            <p style={styles.footnote}>
              문의:{" "}
              <a href="mailto:groundk21@gmail.com" style={styles.link}>
                groundk21@gmail.com
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Success({
  result,
  brand,
}: {
  result: Extract<ReferralSignupResult, { ok: true }>;
  brand: string;
}) {
  const title =
    result.status === "already_active"
      ? "이미 구독 중이신 이메일입니다"
      : result.status === "reactivated"
      ? "구독이 다시 활성화되었습니다"
      : "구독 신청 완료";

  const body =
    result.status === "already_active"
      ? `${result.email} 은(는) 이미 ${brand} 을(를) 구독 중입니다. 메일이 안 오신다면 스팸함을 확인해 주세요.`
      : result.status === "reactivated"
      ? `${result.email} 의 구독이 다시 활성화되었습니다. 다음 호부터 정상 발송됩니다.`
      : `${result.email} 로 다음 호부터 발송됩니다. 관리자가 확인 후 최종 반영됩니다.`;

  return (
    <>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
      <h1 style={styles.h1}>{title}</h1>
      <p style={styles.desc}>{body}</p>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f7f9fa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 16px",
    fontFamily:
      "'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
  },
  card: {
    maxWidth: 480,
    width: "100%",
    background: "white",
    borderRadius: 16,
    padding: "40px 32px",
    boxShadow: "0 2px 24px rgba(0,0,0,0.04)",
    textAlign: "center",
  },
  h1: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1a1a2e",
    margin: "0 0 6px 0",
    letterSpacing: "-0.3px",
  },
  tagline: {
    fontSize: 13,
    color: "#2E3092",
    margin: "0 0 12px 0",
    fontWeight: 500,
  },
  desc: { fontSize: 14, color: "#555", lineHeight: 1.7, margin: "0 0 4px 0" },
  input: {
    width: "100%",
    padding: "12px 14px",
    fontSize: 14,
    border: "1px solid #d0d5dc",
    borderRadius: 8,
    marginBottom: 10,
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  button: {
    width: "100%",
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 600,
    color: "white",
    backgroundColor: "#2E3092",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  error: { fontSize: 12, color: "#b42318", marginTop: 10, marginBottom: 0 },
  footnote: {
    fontSize: 12,
    color: "#888",
    lineHeight: 1.6,
    marginTop: 20,
    marginBottom: 0,
  },
  link: { color: "#2E3092", textDecoration: "underline" },
};
