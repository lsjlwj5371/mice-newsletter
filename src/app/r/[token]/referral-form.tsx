"use client";

import * as React from "react";
import { submitReferralAction } from "./actions";

export function ReferralForm({ token }: { token: string }) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [organization, setOrganization] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState<null | {
    type: "success" | "error";
    text: string;
  }>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setDone(null);
    try {
      const res = await submitReferralAction({
        token,
        email: email.trim(),
        name: name.trim() || null,
        organization: organization.trim() || null,
      });
      if (res.ok) {
        setDone({ type: "success", text: res.message ?? "구독이 완료되었습니다." });
      } else {
        setDone({ type: "error", text: res.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDone({ type: "error", text: `제출 실패: ${msg}` });
    } finally {
      setSubmitting(false);
    }
  }

  if (done?.type === "success") {
    return (
      <div
        style={{
          padding: "20px",
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          borderRadius: 12,
          color: "#065f46",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px 0" }}>
          {done.text}
        </p>
        <p style={{ fontSize: 12, color: "#047857", margin: 0, lineHeight: 1.6 }}>
          다음 호부터 이메일로 받아보실 수 있습니다. 제출하신 주소의 받은편지함을
          확인해 주세요.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ textAlign: "left" }}>
      <Field
        id="email"
        label="이메일 *"
        type="email"
        required
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        disabled={submitting}
      />
      <Field
        id="name"
        label="이름 (선택)"
        value={name}
        onChange={setName}
        placeholder="홍길동"
        disabled={submitting}
      />
      <Field
        id="organization"
        label="조직 (선택)"
        value={organization}
        onChange={setOrganization}
        placeholder="그라운드케이"
        disabled={submitting}
      />

      {done?.type === "error" && (
        <div
          style={{
            padding: "10px 12px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#b91c1c",
            fontSize: 13,
            marginBottom: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {done.text}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !email.trim()}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "#2E3092",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting || !email.trim() ? 0.5 : 1,
        }}
      >
        {submitting ? "제출 중..." : "구독 신청"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  required,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#374151",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 14,
          border: "1px solid #d1d5db",
          borderRadius: 8,
          outline: "none",
          fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
