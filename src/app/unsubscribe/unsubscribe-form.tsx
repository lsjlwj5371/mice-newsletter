"use client";

import * as React from "react";
import { unsubscribeByEmailAction, type UnsubscribeResult } from "./actions";

interface Props {
  brand: string;
}

export function UnsubscribeForm({ brand }: Props) {
  const [email, setEmail] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<UnsubscribeResult | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await unsubscribeByEmailAction(email);
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
            <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
            <h1 style={styles.h1}>수신 거부</h1>
            <p style={styles.desc}>
              {brand} 뉴스레터 수신을 중단하시려면 구독하실 때 사용한
              이메일 주소를 입력해 주세요.
            </p>
            <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
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
                {pending ? "처리 중…" : "수신 거부하기"}
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
  result: Extract<UnsubscribeResult, { ok: true }>;
  brand: string;
}) {
  const title =
    result.status === "already"
      ? "이미 수신 거부된 이메일입니다"
      : "수신 거부 완료";

  const body =
    result.status === "already"
      ? `${result.email} 은(는) 이미 수신 거부 처리된 상태입니다.`
      : `${result.email} 은(는) 이제 ${brand} 뉴스레터를 받지 않습니다.`;

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
    margin: "0 0 12px 0",
    letterSpacing: "-0.3px",
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
  error: {
    fontSize: 12,
    color: "#b42318",
    marginTop: 10,
    marginBottom: 0,
  },
  footnote: {
    fontSize: 12,
    color: "#888",
    lineHeight: 1.6,
    marginTop: 20,
    marginBottom: 0,
  },
  link: { color: "#2E3092", textDecoration: "underline" },
};
