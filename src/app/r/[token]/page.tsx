import { ReferralForm } from "./referral-form";
import { verifyReferralToken } from "@/lib/referral-token";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ReferralPage({ params }: Props) {
  const { token } = await params;
  const claims = verifyReferralToken(token);

  if (!claims) {
    return renderShell(
      <>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h1 style={headingStyle}>유효하지 않은 링크입니다</h1>
        <p style={bodyStyle}>
          링크가 만료됐거나 잘못된 추천 링크입니다. 추천해 주신 분에게 다시
          링크를 받아 주세요.
        </p>
      </>
    );
  }

  return renderShell(
    <>
      <div style={{ fontSize: 32, marginBottom: 8 }}>✉️</div>
      <h1 style={headingStyle}>PIK 뉴스레터 구독</h1>
      <p style={bodyStyle}>
        MICE 산업 종사자를 위한 인사이트 레터, 매월 PIK을 이메일로 받아보세요.
      </p>
      <ReferralForm token={token} />
      <p style={{ ...smallStyle, marginTop: 16 }}>
        제출 즉시 구독자 목록에 추가되며, 원할 때 언제든 수신 거부할 수 있습니다.
      </p>
    </>
  );
}

const headingStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#1a1a2e",
  margin: "0 0 12px 0",
  letterSpacing: "-0.3px",
};

const bodyStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#555",
  lineHeight: 1.7,
  margin: "0 0 20px 0",
};

const smallStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#888",
  lineHeight: 1.6,
  margin: 0,
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
