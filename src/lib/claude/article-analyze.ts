import { getClaudeClient, DEFAULT_MODEL } from "./client";
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type ArticleCategory,
} from "@/lib/validation/rss";

export interface AnalysisInput {
  title: string;
  url: string;
  category: ArticleCategory;
  rawExcerpt: string | null;
  source: string | null;
}

export interface AnalysisResult {
  summary: string;
  tags: string[];
  importance: number; // 1-5
}

const SYSTEM_PROMPT = `너는 한국 MICE(Meetings, Incentives, Conventions, Exhibitions) 산업 전문 뉴스레터 편집자다.
주어진 기사 메타데이터를 읽고 한국어 뉴스레터에 사용하기 위한 분석 결과를 JSON으로 생성한다.

규칙:
- summary: 2~3문장, 한국어 평어체("~다"). 핵심 사실 + 그것이 MICE 산업에 주는 의미.
- tags: 3~6개 한국어 단어 또는 짧은 구. 행사명·기업명·기술·지역·트렌드 등 검색에 쓸 키워드.
- importance: 1(낮음) ~ 5(매우 높음). 다음 기준으로 매겨라:
  5 = MICE 산업 전반에 영향을 주는 정책/제도/대형 행사
  4 = 주요 기업·기관의 의미 있는 움직임, 새로운 기술/방법론 도입
  3 = 일반적인 행사 소식, 참고할 만한 사례
  2 = 단순 보도성 내용
  1 = MICE와 연결성이 약하거나 중요도 낮음
- 본문이 주어지지 않거나 부족하면 제목과 출처만 보고 합리적으로 추정하되, importance를 보수적으로(2~3) 매겨라.
- 절대 추측한 사실을 단정형으로 쓰지 마라. 본문 근거가 약하면 "~으로 보인다", "~로 알려졌다" 같은 표현을 사용.`;

function buildUserMessage(input: AnalysisInput): string {
  return [
    `[카테고리] ${CATEGORY_LABELS[input.category]} — ${CATEGORY_DESCRIPTIONS[input.category]}`,
    `[제목] ${input.title}`,
    `[출처] ${input.source ?? "(알 수 없음)"}`,
    `[URL] ${input.url}`,
    `[본문 발췌]`,
    input.rawExcerpt && input.rawExcerpt.trim().length > 0
      ? input.rawExcerpt
      : "(본문 발췌 없음 — 제목과 출처만 보고 분석)",
    "",
    "다음 JSON 스키마로만 응답하라. 다른 설명·마크다운·코드블록 없이 순수 JSON만:",
    `{
  "summary": "2~3문장 한국어 요약",
  "tags": ["태그1", "태그2", "태그3"],
  "importance": 3
}`,
  ].join("\n");
}

/**
 * Analyze a single article. Throws on Claude API error or unparseable response.
 */
export async function analyzeArticle(
  input: AnalysisInput
): Promise<AnalysisResult> {
  const client = getClaudeClient();

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserMessage(input),
      },
    ],
  });

  // Concatenate all text blocks (Claude may split into multiple)
  const textBlocks = response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text);

  const raw = textBlocks.join("").trim();

  // Try to find a JSON object in the response (defensive in case of extra text)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Claude did not return JSON. Raw: ${raw.slice(0, 200)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse Claude JSON: ${msg}. Raw: ${jsonMatch[0].slice(0, 200)}`);
  }

  // Validate shape
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as Record<string, unknown>).summary !== "string" ||
    !Array.isArray((parsed as Record<string, unknown>).tags) ||
    typeof (parsed as Record<string, unknown>).importance !== "number"
  ) {
    throw new Error(`Claude response shape invalid: ${JSON.stringify(parsed).slice(0, 200)}`);
  }

  const obj = parsed as { summary: string; tags: unknown[]; importance: number };

  const tags = obj.tags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);

  const importance = Math.max(1, Math.min(5, Math.round(obj.importance)));

  return {
    summary: obj.summary.trim(),
    tags,
    importance,
  };
}
