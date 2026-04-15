import { getClaudeClient, DRAFT_MODEL } from "./client";
import {
  newsletterContentSchema,
  type NewsletterContentParsed,
} from "@/lib/validation/newsletter-content";
import type { Article, ArticleCategory } from "@/lib/validation/rss";
import type { NewsletterContent } from "@/types/newsletter";

// Constant header content — SPEAK branding never changes per issue
const SPEAK_HEADER = {
  topMessage: "보이지 않던 것들을 말해드립니다.",
  wordmark: "SPEAK",
  subtitle: "Stories People in micE Always Know | by GroundK",
  // Indices of S, P, E, A, K in the subtitle above
  boldIndices: (() => {
    const s = "Stories People in micE Always Know | by GroundK";
    return [
      s.indexOf("S"), // S
      s.indexOf("P"), // P
      s.indexOf("E"), // micE
      s.indexOf("A"), // Always
      s.indexOf("K"), // Know
    ];
  })(),
};

const REFERRAL_CTA_DEFAULT = {
  message:
    "지금부터 드리는 정보가 유익하셨거나, 함께 받으면 좋을 분이 떠오르셨다면 알려주세요. 다음 호부터 그분께도 전달해드리겠습니다.",
  buttonLabel: "추천하기",
  buttonHref: "{{REFERRAL_HREF}}",
};

const FOOTER_DEFAULT = {
  brandName: "GroundK",
  links: [
    { label: "groundk.co.kr", href: "https://groundk.co.kr" },
    { label: "triseup.com", href: "https://triseup.com" },
    { label: "rideus.co.kr", href: "https://rideus.co.kr" },
  ],
  unsubscribeHref: "{{UNSUBSCRIBE_HREF}}",
};

export interface DraftGenerationInput {
  issueLabel: string;
  /** Articles grouped by category, already filtered by date range */
  articlesByCategory: Record<ArticleCategory, Article[]>;
  /** Free-form admin references / insights for this issue */
  referenceNotes?: string;
}

export interface DraftGenerationResult {
  content: NewsletterContent;
  usedArticleIds: string[];
}

const SYSTEM_PROMPT = `당신은 "SPEAK" 뉴스레터의 편집장입니다. 한국 MICE(Meetings, Incentives, Conventions, Exhibitions) 산업 종사자를 대상으로 하는 월간/격주 인사이트 뉴스레터입니다.

## 역할
주어진 후보 기사들과 관리자 사전 레퍼런스를 바탕으로 한 호의 전체 콘텐츠를 JSON으로 생성합니다.

## 톤앤매너
- 한국어 평어체 (~다, ~입니다)
- 정보 전달 + 인사이트 균형. 단순 보도 요약이 아니라 "MICE 업계에 어떤 의미인가"까지 짚을 것
- 추측을 단정형으로 쓰지 말 것. 근거가 약하면 "~으로 보인다", "~로 알려졌다"
- 본문은 간결하되 무미건조하지 않게. 살짝의 해설/관점이 담기도록

## 출력 규약
- 반드시 단일 JSON 객체로만 응답. 마크다운 코드블록·설명·인사 금지
- 모든 한국어 텍스트는 자연스러운 문장으로
- 본문 안에 \`**굵게**\` 마크업으로 핵심 키워드 강조 가능 (1~2개/단락)

## 섹션별 가이드

### openingHook
- hook: 2~4줄. 이번 호의 큰 흐름을 압축한 큐레이션 메시지. 줄바꿈은 \\n
- subtext: 1~2문장. hook을 보충

### numberOfMonth
- 후보 기사들에서 "이번 달 가장 의미 있는 수치 1개" 추출
- number: 숫자만 (예: "73"). 단위는 suffix에 분리 (예: "%", "건", "명")
- caption: 1~2문장. 무엇을 의미하는 수치인지. **bold** 강조 가능
- source: 출처 + 비교 컨텍스트가 있으면 함께

### newsBriefing
- **반드시 정확히 3개**의 items
- 각 item:
  - categoryTag: 짧은 분류 (예: "정책 · 규제", "경제 · 산업")
  - title: 14~28자 헤드라인
  - body: 2~3문장
  - insight: { label: "MICE 연결", text: 1~2문장 — 이 뉴스가 MICE 산업에 어떤 함의인지 }

### miceInOut
- inItem: 국내(한국) 단일 사례 1건
- outItem: 해외/글로벌 단일 사례 1건
- 각각 categoryTag, title, body (2~3문장), source (출처)
- categoryTag는 "IN · 국내" / "OUT · 글로벌" 그대로 사용

### techSignal
- 1개 핵심 기술 토픽
- topicLabel: 짧은 키워드 (예: "Agentic AI", "Spatial Computing")
- topicMeta: "{발행월} · 이번 달 가장 뜨거운 기술 이슈" 형태
- title: 헤드라인. 1~2줄
- paragraphs: 1~2개 단락. 각 단락 3~5문장. **bold** 강조 가능
- miceInsight: 이 기술이 MICE 현장에 어떻게 적용될지 1~2문장

### theoryToField
- 학술/이론 1개를 골라 현장 적용으로 연결
- sourceYear: 이론 발표 연도 (예: "1990")
- sourceAuthor: "저자명 / 소속" 형태
- sourceMeta: 영문 부제 (선택)
- title: 호기심 자극 헤드라인 (예: "왜 오후 2시 세션은 항상 집중이 안 될까")
- introParagraphs: 1~2개 단락. 이론 소개
- bridge: { label: "→ 현장에서는", text: 1~2문장 — 이 이론이 한국 MICE 현장에선 어떻게 적용/안 되고 있는지 }
- outroParagraphs: 1개 단락. 마무리 통찰
- closingNote: 1문장 italic 클로징

### nowMice
- 이달의 이슈 / 칼럼
- title: 2줄로 끊기 가능 (\\n)
- leadParagraph: 진입 1문장
- pullQuote: 풀아웃 인용. 짧고 강렬하게 (옵셔널)
- paragraphs: 2~3개 단락
- closingNote: 1문장 italic 클로징

### groundkStory
- fieldBriefing.body: 1~2 문단의 짧은 현장 브리핑. 사전 레퍼런스에 그라운드케이 현장 정보가 있으면 우선 활용. 없으면 후보 기사 중 운영 관점 이슈 1건 선택해서 작성
- projectSketch: 사전 레퍼런스에 프로젝트 정보가 있으면 그것을 활용. 없으면 paragraphs 3개를 합리적인 placeholder 텍스트로 채울 것 (관리자가 나중에 편집)

## 출력 JSON 스키마
\`\`\`
{
  "issueLabel": "(주어진 issueLabel 그대로)",
  "subject": "[SPEAK] {호 이름} — {핵심 키워드 1~2개}",
  "header": { "topMessage": "보이지 않던 것들을 말해드립니다.", "wordmark": "SPEAK", "subtitle": "Stories People in micE Always Know | by GroundK", "boldIndices": [0, 8, 18, 20, 27] },
  "referralCta": { "message": "지금부터 드리는 정보가 유익하셨거나, ...", "buttonLabel": "추천하기", "buttonHref": "{{REFERRAL_HREF}}" },
  "openingHook": { "hook": "...\\n...\\n...", "subtext": "..." },
  "numberOfMonth": { "number": "73", "suffix": "%", "caption": "...", "source": "..." },
  "newsBriefing": { "englishLabel": "News Briefing", "items": [ {3개}, ... ] },
  "miceInOut": { "englishLabel": "MICE IN & OUT", "inItem": {...}, "outItem": {...} },
  "techSignal": { "englishLabel": "Tech Signal", "topicLabel": "...", "topicMeta": "...", "title": "...", "paragraphs": ["..."], "miceInsight": "..." },
  "theoryToField": { "englishLabel": "From Theory to Field", "sourceYear": "...", "sourceAuthor": "...", "title": "...", "introParagraphs": ["..."], "bridge": {"label": "→ 현장에서는", "text": "..."}, "outroParagraphs": ["..."], "closingNote": "..." },
  "nowMice": { "englishLabel": "지금 MICE는", "eyebrow": "이달의 이슈", "title": "...", "leadParagraph": "...", "pullQuote": "...", "paragraphs": ["..."], "closingNote": "..." },
  "groundkStory": { "englishLabel": "GroundK Story", "fieldBriefing": {...}, "projectSketch": {...} },
  "footer": { "brandName": "GroundK", "links": [...], "unsubscribeHref": "{{UNSUBSCRIBE_HREF}}" }
}
\`\`\`

referralCta, footer는 위 기본값을 그대로 출력하세요. header도 위 값을 그대로 출력하되 boldIndices는 정확히 [0, 8, 18, 20, 27] 로.`;

function formatArticleForPrompt(a: Article, idx: number): string {
  const lines = [
    `[${idx + 1}] ${a.title}`,
    `    카테고리: ${a.category}`,
    a.source ? `    출처: ${a.source}` : null,
    a.published_at ? `    발행: ${a.published_at.slice(0, 10)}` : null,
    a.summary ? `    요약: ${a.summary}` : null,
    a.tags.length > 0 ? `    태그: ${a.tags.join(", ")}` : null,
    a.importance ? `    중요도: ${a.importance}/5` : null,
    `    URL: ${a.url}`,
    `    article_id: ${a.id}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function buildUserMessage(input: DraftGenerationInput): string {
  const sections: string[] = [];

  sections.push(`# 이번 호 정보`);
  sections.push(`issueLabel: ${input.issueLabel}`);
  sections.push("");

  // Each category section
  const labels: Record<ArticleCategory, string> = {
    news: "News Briefing 후보 (반드시 3개 선정)",
    mice_in_out: "MICE IN & OUT 후보 (IN 1건 + OUT 1건 선정)",
    tech: "Tech Signal 후보 (1건 선정)",
    theory: "From Theory to Field 후보 (1건 선정 또는 합리적 추론)",
  };

  for (const cat of ["news", "mice_in_out", "tech", "theory"] as const) {
    const arts = input.articlesByCategory[cat] ?? [];
    sections.push(`## ${labels[cat]}`);
    if (arts.length === 0) {
      sections.push(
        `(이 카테고리에 후보 기사가 없습니다. 합리적인 placeholder 콘텐츠로 채우거나 다른 카테고리에서 차용하세요.)`
      );
    } else {
      arts.forEach((a, i) => sections.push(formatArticleForPrompt(a, i)));
    }
    sections.push("");
  }

  if (input.referenceNotes && input.referenceNotes.trim().length > 0) {
    sections.push(`# 관리자 사전 레퍼런스 / 인사이트`);
    sections.push(input.referenceNotes.trim());
    sections.push("");
    sections.push(
      `위 레퍼런스를 groundkStory 섹션과 (관련 있다면) 다른 섹션에도 우선적으로 반영하세요.`
    );
    sections.push("");
  } else {
    sections.push(
      `# 관리자 사전 레퍼런스 없음 — groundkStory.fieldBriefing은 후보 기사 중 운영 관점 1건을 선택, projectSketch는 placeholder로 작성`
    );
    sections.push("");
  }

  sections.push(`# 출력`);
  sections.push(`위 시스템 프롬프트의 JSON 스키마에 맞춰 단일 JSON 객체로만 응답하세요. 마크다운 코드블록 사용 금지.`);

  return sections.join("\n");
}

/**
 * Generate a newsletter draft using Claude.
 * Throws on Claude API error or invalid JSON output.
 */
export async function generateNewsletterDraft(
  input: DraftGenerationInput
): Promise<DraftGenerationResult> {
  const client = getClaudeClient();
  const userMessage = buildUserMessage(input);

  const response = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlocks = response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text);
  const raw = textBlocks.join("").trim();

  // Extract JSON (defensive — in case Claude wraps in markdown despite instructions)
  let jsonString = raw;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    jsonString = fenced[1].trim();
  } else {
    // Find first { ... last }
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonString = raw.slice(firstBrace, lastBrace + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Claude returned invalid JSON: ${msg}. First 300 chars: ${jsonString.slice(0, 300)}`
    );
  }

  // Validate against zod schema
  const result = newsletterContentSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Claude output failed schema validation:\n${issues}\n\nFirst 400 chars of JSON: ${jsonString.slice(
        0,
        400
      )}`
    );
  }

  // Force constants — even if Claude tweaked them
  const content: NewsletterContent = {
    ...result.data,
    header: SPEAK_HEADER,
    referralCta: REFERRAL_CTA_DEFAULT,
    footer: { ...FOOTER_DEFAULT, ...result.data.footer, brandName: "GroundK" },
  };

  // Collect all article IDs we showed to Claude (for traceability)
  const usedArticleIds = Object.values(input.articlesByCategory)
    .flat()
    .map((a) => a.id);

  return { content, usedArticleIds };
}
