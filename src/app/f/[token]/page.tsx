import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFormToken } from "@/lib/form-token";
import { PublicForm } from "./public-form";
import type { FormRow } from "@/lib/validation/form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function FormPage({ params }: Props) {
  const { token } = await params;
  const claims = verifyFormToken(token);

  if (!claims) {
    return renderShell(
      <ErrorShell
        title="유효하지 않은 링크입니다"
        body="이 링크는 만료되었거나 잘못된 폼 링크입니다."
      />
    );
  }

  const supabase = createAdminClient();
  const { data: formRow } = await supabase
    .from("forms")
    .select("*")
    .eq("id", claims.formId)
    .single();

  if (!formRow) {
    return renderShell(
      <ErrorShell
        title="폼을 찾을 수 없습니다"
        body="삭제되었거나 아직 준비되지 않은 폼일 수 있습니다."
      />
    );
  }

  const form = formRow as FormRow;

  if (!form.is_open) {
    return renderShell(
      <ErrorShell
        title="응답이 마감되었습니다"
        body={`"${form.title}" 폼은 더 이상 응답을 받지 않습니다. 관심 가져주셔서 감사합니다.`}
      />
    );
  }

  return renderShell(
    <>
      <h1 style={headingStyle}>{form.title}</h1>
      {form.description && (
        <p style={descStyle}>{form.description}</p>
      )}
      <PublicForm token={token} form={form} />
    </>
  );
}

function ErrorShell({ title, body }: { title: string; body: string }) {
  return (
    <>
      <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
      <h1 style={headingStyle}>{title}</h1>
      <p style={descStyle}>{body}</p>
    </>
  );
}

const headingStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: "#1a1a2e",
  margin: "0 0 12px 0",
  letterSpacing: "-0.3px",
};
const descStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#555",
  lineHeight: 1.7,
  margin: "0 0 24px 0",
  whiteSpace: "pre-wrap",
};

function renderShell(children: React.ReactNode) {
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
          maxWidth: 560,
          width: "100%",
          background: "white",
          borderRadius: 16,
          padding: "40px 32px",
          boxShadow: "0 2px 24px rgba(0,0,0,0.04)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
