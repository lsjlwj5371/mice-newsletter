import { getClaudeClient, DRAFT_MODEL } from "./client";
import { newsletterContentSchema } from "@/lib/validation/newsletter-content";
import type { Article, ArticleCategory } from "@/lib/validation/rss";
import type { NewsletterContent, BlockType } from "@/types/newsletter";

// Fixed sections — PIK branding stays constant
const PIK_HEADER = {
  wordmark: "PIK",
  tagline: "We pick what moves you",
  industryTag: "MICE · PCO · Event Industry",
  issueMeta: "",           // filled per-issue from input.issueLabel
  description: "업계 종사자를 위한 인사이트 레터 · by GroundK",
};

const REFERRAL_CTA_DEFAULT = {
  message:
    "지금부터 드리는 정보가 유익하셨거나, 함께 받으면 좋을 분이 떠오르셨다면 알려주세요. 다음 호부터 그분께도 전달해드리겠습니다.",
  buttonLabel: "추천하기",
  buttonHref: "{{REFERRAL_HREF}}",
};

const FOOTER_DEFAULT = {
  brandName: "PIK by GroundK",
  brandTagline: "We pick what moves you",
  links: [
    { label: "groundk.co.kr", href: "https://groundk.co.kr" },
    { label: "triseup.com", href: "https://triseup.com" },
    { label: "rideus.co.kr", href: "https://rideus.co.kr" },
  ],
  unsubscribeHref: "{{UNSUBSCRIBE_HREF}}",
};

// Default block selection for auto-generated drafts (when admin doesn't
// specify via the block picker). Matches the Ver.1 modular layout.
export const DEFAULT_BLOCK_TYPES: BlockType[] = [
  "opening_lede",
  "stat_feature",
  "news_briefing",
  "in_out_comparison",
  "tech_signal",
  "theory_to_field",
  "editor_take",
  "groundk_story",
];

export interface DraftGenerationInput {
  issueLabel: string;
  articlesByCategory: Record<ArticleCategory, Article[]>;
  referenceNotes?: string;
  /**
   * Block types to include in this issue, in order. If omitted, uses
   * DEFAULT_BLOCK_TYPES.
   */
  blockTypes?: BlockType[];
}

export interface DraftGenerationResult {
  content: NewsletterContent;
  usedArticleIds: string[];
}

const BLOCK_GUIDANCE: Record<BlockType, string> = {
  opening_lede: `opening_lede: { hook: "2~4줄 한 호 테마 압축 메시지, \\n으로 줄바꿈", subtext: "1~2문장 부연" }`,
  stat_feature: `stat_feature: { englishLabel: "Number of the Month", number: "숫자만", suffix: "% 또는 단위", caption: "**bold** 사용 가능, 1~2문장", source: "출처 + 비교 수치가 있으면 같이" }`,
  news_briefing: `news_briefing: { englishLabel: "News Briefing", items: [정확히 3개. 각 item = { categoryTag, title (14~28자), body (2~3문장), insight: { label: "MICE 연결", text: 1~2문장 } }] }`,
  in_out_comparison: `in_out_comparison: { englishLabel: "MICE IN & OUT", inItem: { categoryTag: "IN · 국내", title, body (2~3문장), source }, outItem: { categoryTag: "OUT · 글로벌", title, body, source } }`,
  tech_signal: `tech_signal: { englishLabel: "Tech Signal", topicLabel: "키워드 (예: Agentic AI)", topicMeta: "YYYY.MM · 설명", title, paragraphs: [1~2개 단락, **bold** 가능], miceInsight: "1~2문장" }`,
  theory_to_field: `theory_to_field: { englishLabel: "From Theory to Field", sourceYear, sourceAuthor, sourceMeta, title, introParagraphs: [1~2단락], bridge: { label: "→ 현장에서는", text }, outroParagraphs: [1단락], closingNote: "1문장" }`,
  editor_take: `editor_take: { englishLabel: "지금 MICE는", eyebrow: "이달의 이슈", title (\\n 가능), leadParagraph: "1문장", pullQuote: "짧고 강렬한 인용", paragraphs: [2~3단락], closingNote: "1문장" }`,
  groundk_story: `groundk_story: { englishLabel: "GroundK Story", fieldBriefing: { eyebrow: "이달의 현장 브리핑", categoryTag: "운영 카테고리", body: "1~2단락 (\\n\\n 구분, **bold** 가능)" }, projectSketch: { projectMeta: "Project · 이름", dateMeta: "YYYY.MM.DD", eyebrow: "그라운드케이 프로젝트 스케치", title, paragraphs: [정확히 3개 단락], tags: [3개 정도] } }`,
  consolidated_insight: `consolidated_insight: { englishLabel: "GroundK Insight", parts: [2~4개. 각 part = { categoryTag, title, paragraphs: [2~4단락], insight: { text: 1~2문장 } }] }`,
  blog_card_grid: `blog_card_grid: { englishLabel: "GroundK Blog", cards: [2~6개. 각 card = { label: "Field Note / Project Story / Industry Insight / Tech & MICE 중 하나", title, description: "2~3줄", linkUrl: "https://blog.naver.com/groundk" }] }`,
};

function buildSystemPrompt(blockTypes: BlockType[]): string {
  const blockGuidance = blockTypes
    .map((t, i) => `  ${i + 1}. ${BLOCK_GUIDANCE[t]}`)
    .join("\n");

  return `당신은 "PIK" 뉴스레터의 편집장입니다. 한국 MICE 산업 종사자를 대상으로 하는 인사이트 뉴스레터입니다.

## 역할
주어진 후보 기사들과 관리자 사전 레퍼런스를 바탕으로 요청된 블록 순서대로 한 호의 콘텐츠를 JSON으로 생성합니다.

## 톤앤매너
- 한국어 평어체 (~다, ~입니다 혼용 자연스럽게)
- 정보 전달 + 인사이트 균형. 단순 보도 요약이 아니라 "MICE 업계에 어떤 의미인가"까지 짚을 것
- 추측을 단정형으로 쓰지 말 것. 근거가 약하면 "~으로 보인다"
- 본문 안에 \`**굵게**\` 마크업으로 핵심 키워드 강조 가능 (1~2개/단락)

## 출력 규약
- 반드시 단일 JSON 객체로만 응답. 마크다운 코드블록·설명·인사 금지
- 최상위 필드: issueLabel, subject, header, referralCta, blocks, footer

## 고정 필드 (아래 값 그대로 출력)
- header: { wordmark: "PIK", tagline: "We pick what moves you", industryTag: "MICE · PCO · Event Industry", issueMeta: "{입력된 issueLabel}", description: "업계 종사자를 위한 인사이트 레터 · by GroundK" }
- referralCta: { message: "지금부터 드리는 정보가 유익하셨거나, 함께 받으면 좋을 분이 떠오르셨다면 알려주세요. 다음 호부터 그분께도 전달해드리겠습니다.", buttonLabel: "추천하기", buttonHref: "{{REFERRAL_HREF}}" }
- footer: { brandName: "PIK by GroundK", brandTagline: "We pick what moves you", links: [{label:"groundk.co.kr",href:"https://groundk.co.kr"},{label:"triseup.com",href:"https://triseup.com"},{label:"rideus.co.kr",href:"https://rideus.co.kr"}], unsubscribeHref: "{{UNSUBSCRIBE_HREF}}" }

## 이번 호의 blocks (반드시 이 순서대로 이 타입만 생성)
${blockGuidance}

## blocks 배열 스키마
각 block = { id: "b1", "b2", ... (순서대로), type: "위에 지정된 타입", data: {위 타입별 스키마} }

- id는 "b1", "b2", ... 식으로 순서대로 부여
- type은 반드시 위 지정 타입
- instructions, autoSearch 필드는 생성하지 말 것 (그건 admin이 나중에 추가)

## 추가 규칙
- subject는 "[PIK] {호 이름} — {핵심 키워드 1~2개}" 형태로
- issueLabel은 입력값을 그대로 사용`;
}

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
  ].filter(Boolean);
  return lines.join("\n");
}

function buildUserMessage(
  input: DraftGenerationInput,
  blockTypes: BlockType[]
): string {
  const sections: string[] = [];

  sections.push(`# 이번 호 정보`);
  sections.push(`issueLabel: ${input.issueLabel}`);
  sections.push(`생성할 블록 순서: ${blockTypes.join(" → ")}`);
  sections.push("");

  const labels: Record<ArticleCategory, string> = {
    news: "news 카테고리 기사 (News Briefing 용)",
    mice_in_out: "mice_in_out 카테고리 기사 (MICE IN & OUT 용)",
    tech: "tech 카테고리 기사 (Tech Signal 용)",
    theory: "theory 카테고리 기사 (Theory to Field 용)",
  };

  for (const cat of ["news", "mice_in_out", "tech", "theory"] as const) {
    const arts = input.articlesByCategory[cat] ?? [];
    sections.push(`## ${labels[cat]}`);
    if (arts.length === 0) {
      sections.push(
        `(후보 기사 없음 — 해당 블록을 생성해야 할 경우 합리적인 placeholder로 작성하거나 다른 카테고리에서 차용)`
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
      `위 레퍼런스를 관련 블록(특히 groundk_story / editor_take)에 우선 반영.`
    );
    sections.push("");
  }

  sections.push(`# 출력`);
  sections.push(
    `시스템 프롬프트의 규칙에 따라 단일 JSON 객체로만 응답. 마크다운 코드블록 금지. blocks 배열은 위 지정 순서를 반드시 지킬 것.`
  );

  return sections.join("\n");
}

export async function generateNewsletterDraft(
  input: DraftGenerationInput
): Promise<DraftGenerationResult> {
  const client = getClaudeClient();
  const blockTypes = input.blockTypes ?? DEFAULT_BLOCK_TYPES;
  const userMessage = buildUserMessage(input, blockTypes);

  const response = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 8000,
    system: buildSystemPrompt(blockTypes),
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlocks = response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text);
  const raw = textBlocks.join("").trim();

  // Extract JSON defensively
  let jsonString = raw;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    jsonString = fenced[1].trim();
  } else {
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

  // Force constants regardless of what Claude emitted
  const content: NewsletterContent = {
    ...result.data,
    header: {
      ...PIK_HEADER,
      issueMeta: input.issueLabel,
    },
    referralCta: REFERRAL_CTA_DEFAULT,
    footer: FOOTER_DEFAULT,
  };

  const usedArticleIds = Object.values(input.articlesByCategory)
    .flat()
    .map((a) => a.id);

  return { content, usedArticleIds };
}
