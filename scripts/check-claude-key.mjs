// Anthropic API 키 한 건을 그대로 때려 보고 상태만 찍는 진단 스크립트.
//
// 쓰는 법 (PowerShell):
//   $env:ANTHROPIC_API_KEY = "sk-ant-..."
//   node scripts/check-claude-key.mjs
//
// 조직 범위 개인 키를 확인할 때는 워크스페이스 ID 도 같이 줄 수 있다.
//   $env:ANTHROPIC_WORKSPACE_ID = "wrkspc_..."
//
// 환경변수를 주지 않으면 .env.local 의 값을 읽는다. 키 자체는 출력하지
// 않고 앞 7자와 길이만 보여 준다.
import { readFileSync } from "node:fs";

const MODEL = "claude-haiku-4-5"; // 앱이 실제로 쓰는 모델과 동일하게 유지

function keyFromEnvFile() {
  try {
    const line = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("ANTHROPIC_API_KEY="));
    return line
      ? line.slice("ANTHROPIC_API_KEY=".length).replace(/^"|"$/g, "")
      : "";
  } catch {
    return "";
  }
}

const key = process.env.ANTHROPIC_API_KEY || keyFromEnvFile();
if (!key) {
  console.error(
    "키가 없습니다. ANTHROPIC_API_KEY 를 설정하거나 .env.local 에 넣으면 됩니다."
  );
  process.exitCode = 1;
} else {
  const source = process.env.ANTHROPIC_API_KEY ? "환경변수" : ".env.local";
  console.log(`키: ${key.slice(0, 7)}... (길이 ${key.length}, 출처 ${source})`);

  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  if (key.startsWith("sk-ant-usr-")) {
    console.log(
      `종류: 개인 키(identity-linked). 워크스페이스 범위가 아니면 anthropic-workspace-id 헤더가 필요합니다. 이번 호출은 헤더 ${workspaceId ? "있음" : "없음"}.`
    );
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      ...(workspaceId ? { "anthropic-workspace-id": workspaceId } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16,
      messages: [{ role: "user", content: "ping" }],
    }),
  });

  const text = await res.text();
  console.log(`HTTP ${res.status}`);

  if (res.ok) {
    console.log("정상입니다. 분석과 초안 생성이 동작해야 합니다.");
  } else {
    // 자주 나오는 실패를 사람이 읽을 수 있는 원인으로 바꿔 준다.
    let message = text;
    try {
      message = JSON.parse(text)?.error?.message ?? text;
    } catch {
      // 파싱이 안 되면 원문 그대로 둔다
    }
    console.log(`원문: ${message}`);

    if (/anthropic-workspace-id/i.test(message)) {
      console.log(
        "원인: 조직 범위 개인 키라 워크스페이스 지정이 필요합니다. 키를 워크스페이스 범위로 다시 발급하거나, ANTHROPIC_WORKSPACE_ID 를 설정하면 됩니다."
      );
    } else if (/credit balance/i.test(message)) {
      console.log(
        "원인: 이 키가 속한 조직의 크레딧 잔액이 0입니다. 키 문제가 아니라 결제 문제입니다."
      );
    } else if (res.status === 401) {
      console.log(
        "원인: 키가 잘못됐거나 폐기됐습니다. 값이 잘려 들어갔는지도 확인할 필요가 있습니다."
      );
    } else if (res.status === 404) {
      console.log(`원인: 이 조직에서 ${MODEL} 모델을 쓸 수 없습니다.`);
    } else if (res.status === 429) {
      console.log("원인: 속도 제한 또는 사용량 한도입니다. 잠시 후 다시 시도하면 됩니다.");
    }
    process.exitCode = 1;
  }
}
