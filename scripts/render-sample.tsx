// 샘플 뉴스레터를 HTML 파일로 렌더해서 눈으로 확인하는 개발용 스크립트.
//   npx tsx scripts/render-sample.mjs.tsx [출력경로]
// 기본 출력은 .next/sample-preview.html (git 에 올라가지 않는 자리).
import * as React from "react";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { render } from "@react-email/render";
import Newsletter from "@/emails/Newsletter";
import { sampleNewsletter } from "@/lib/sample-newsletter";

async function main() {
  const out = process.argv[2] ?? ".next/sample-preview.html";
  const html = await render(
    <Newsletter content={sampleNewsletter} appUrl="https://example.com" />,
    { pretty: true }
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html, "utf8");
  console.log(`${out} 에 ${html.length} 바이트 기록`);
}

main();
