"use client";

import * as React from "react";
import type { FormRow, FormField } from "@/lib/validation/form";
import { submitFormAction } from "./actions";

export function PublicForm({
  token,
  form,
}: {
  token: string;
  form: FormRow;
}) {
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState<null | {
    type: "success" | "error";
    text: string;
  }>(null);

  function updateAnswer(fieldId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setDone(null);
    try {
      const res = await submitFormAction({
        token,
        answers,
        email: email || undefined,
        name: name || undefined,
      });
      if (res.ok) {
        setDone({ type: "success", text: res.message ?? "응답이 제출되었습니다." });
      } else {
        setDone({ type: "error", text: res.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDone({ type: "error", text: `오류: ${msg}` });
    } finally {
      setSubmitting(false);
    }
  }

  if (done?.type === "success") {
    return (
      <div
        style={{
          padding: "24px",
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          borderRadius: 12,
          color: "#065f46",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
        <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px 0" }}>
          {done.text}
        </p>
        <p style={{ fontSize: 13, color: "#047857", margin: 0, lineHeight: 1.7 }}>
          응답 주셔서 감사합니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {form.fields.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          value={answers[field.id]}
          onChange={(v) => updateAnswer(field.id, v)}
          disabled={submitting}
        />
      ))}

      {/* Optional: email + name so admin can attribute responses */}
      <div
        style={{
          marginTop: 16,
          padding: "16px",
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px 0" }}>
          응답자 정보 (선택) — 입력하시면 관리자가 후속 연락을 드릴 수 있습니다.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            id="resp-email"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={setEmail}
            disabled={submitting}
          />
          <Input
            id="resp-name"
            placeholder="이름"
            value={name}
            onChange={setName}
            disabled={submitting}
          />
        </div>
      </div>

      {done?.type === "error" && (
        <div
          style={{
            marginTop: 16,
            padding: "12px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#b91c1c",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {done.text}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          marginTop: 20,
          width: "100%",
          padding: "12px 16px",
          background: "#2E3092",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.5 : 1,
        }}
      >
        {submitting ? "제출 중..." : "제출"}
      </button>
    </form>
  );
}

function FieldRow({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={`f-${field.id}`}
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "#1f2937",
          marginBottom: 6,
        }}
      >
        {field.label}
        {field.required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>
      {field.type === "text" && (
        <Input
          id={`f-${field.id}`}
          value={(value as string) ?? ""}
          onChange={onChange}
          placeholder={field.placeholder}
          required={field.required}
          disabled={disabled}
        />
      )}
      {field.type === "email" && (
        <Input
          id={`f-${field.id}`}
          type="email"
          value={(value as string) ?? ""}
          onChange={onChange}
          placeholder={field.placeholder}
          required={field.required}
          disabled={disabled}
        />
      )}
      {field.type === "textarea" && (
        <textarea
          id={`f-${field.id}`}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          disabled={disabled}
          rows={4}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 14,
            border: "1px solid #d1d5db",
            borderRadius: 8,
            outline: "none",
            fontFamily: "inherit",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      )}
      {field.type === "choice" && field.choices && (
        <div>
          {field.choices.map((c, i) => (
            <label
              key={i}
              style={{
                display: "block",
                marginBottom: 6,
                fontSize: 14,
                color: "#1f2937",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              <input
                type="radio"
                name={`f-${field.id}`}
                value={c}
                checked={value === c}
                onChange={() => onChange(c)}
                required={field.required}
                disabled={disabled}
                style={{ marginRight: 8 }}
              />
              {c}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Input({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  disabled,
}: {
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
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
  );
}
