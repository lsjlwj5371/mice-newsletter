import { getClaudeClient, DRAFT_MODEL } from "./client";
import { BLOCK_DATA_SCHEMAS } from "@/lib/validation/newsletter-content";
import type { Article, ArticleCategory } from "@/lib/validation/rss";
import type {
  NewsletterContent,
  BlockInstance,
  BlockType,
} from "@/types/newsletter";

// ─────────────────────────────────────────────
// Fixed branding constants
// ─────────────────────────────────────────────

const PIK_HEADER = {
  wordmark: "PIK",
  tagline: "We pick what moves you",
  industryTag: "MICE · PCO · Event Industry",
  issueMeta: "",
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

// ─────────────────────────────────────────────
// Per-block schemas (for Claude prompt + validation)
// ─────────────────────────────────────────────

const BLOCK_SCHEMA_PROMPT: Record<BlockType, string> = {
  opening_lede: `{ "hook": "2~4줄 한 호 테마 압축. \\n으로 줄바꿈", "subtext": "1~2문장 부연 (선택)" }`,
  stat_feature: `{ "englishLabel": "Number of the Month", "number": "숫자만 (예: 73)", "suffix": "% 또는 단위 (선택)", "caption": "**bold** 가능, 1~2문장", "source": "출처 + 비교 수치" }`,
  news_briefing: `{ "englishLabel": "News Briefing", "items": [정확히 3개. 각 item = { "categoryTag": "경제 · 산업 등", "title": "14~28자", "body": "2~3문장", "insight": { "label": "MICE 연결", "text": "1~2문장 MICE 산업 함의" } }] }`,
  in_out_comparison: `{ "englishLabel": "MICE IN & OUT", "inItem": { "categoryTag": "IN · 국내", "title": "한국 관련 소식", "body": "2~3문장", "source": "출처" }, "outItem": { "categoryTag": "OUT · 글로벌", "title": "해외 관련 소식", "body": "2~3문장", "source": "출처" } }`,
  tech_signal: `{ "englishLabel": "Tech Signal", "topicLabel": "Agentic AI 등 키워드", "topicMeta": "YYYY.MM · 이번 달 가장 뜨거운 기술 이슈", "title": "헤드라인", "paragraphs": ["1~2개 단락, **bold** 가능"], "miceInsight": "1~2문장" }`,
  theory_to_field: `{ "englishLabel": "From Theory to Field", "sourceYear": "1990", "sourceAuthor": "저자명 / 소속", "sourceMeta": "영문 부제", "title": "호기심 자극 헤드라인", "introParagraphs": ["1~2단락"], "bridge": { "label": "→ 현장에서는", "text": "1~2문장" }, "outroParagraphs": ["1단락"], "closingNote": "1문장 italic" }`,
  editor_take: `{ "englishLabel": "지금 MICE는", "eyebrow": "이달의 이슈", "title": "\\n 가능", "leadParagraph": "진입 1문장", "pullQuote": "짧고 강렬한 인용", "paragraphs": ["2~3단락"], "closingNote": "1문장 italic" }`,
  groundk_story: `{ "englishLabel": "GroundK Story", "fieldBriefing": { "eyebrow": "이달의 현장 브리핑", "categoryTag": "공항 운영 등", "body": "1~2단락. \\n\\n 구분, **bold** 가능" }, "projectSketch": { "projectMeta": "Project · 이름", "dateMeta": "YYYY.MM.DD", "eyebrow": "그라운드케이 프로젝트 스케치", "title": "타이틀", "paragraphs": ["정확히 3개 단락"], "tags": ["태그 3개 정도"] } }`,
  consolidated_insight: `{ "englishLabel": "GroundK Insight", "parts": [2~4개. 각 part = { "categoryTag": "테마 카테고리", "title": "타이틀", "paragraphs": ["2~4단락"], "insight": { "text": "1~2문장" } }] }`,
  blog_card_grid: `{ "englishLabel": "GroundK Blog", "cards": [2~6개. 각 card = { "label": "Field Note / Project Story / Industry Insight / Tech & MICE 중 하나", "title": "제목", "description": "2~3줄 설명", "linkUrl": "https://blog.naver.com/groundk" }] }`,
};

const BLOCK_RELEVANT_CATEGORIES: Record<BlockType, ArticleCategory[]> = {
  opening_lede: [], // no articles — narrative
  stat_feature: ["news", "tech", "mice_in_out"],
  news_briefing: ["news"],
  in_out_comparison: ["mice_in_out"],
  tech_signal: ["tech"],
  theory_to_field: ["theory"],
  editor_take: [], // no articles — commentary
  groundk_story: [], // no articles — internal case
  consolidated_insight: ["news", "mice_in_out", "tech", "theory"],
  blog_card_grid: [], // no articles — blog list
};

// ─────────────────────────────────────────────
// Placeholder data for blocks that skip Claude
// ─────────────────────────────────────────────

function getPlaceholderData(type: BlockType): unknown {
  switch (type) {
    case "opening_lede":
      return {
        hook: "여기에 이번 호의 오프닝 메시지를 작성하세요.",
        subtext: "호의 방향성을 한두 문장으로 요약합니다.",
      };
    case "stat_feature":
      return {
        englishLabel: "Number of the Month",
        number: "00",
        suffix: "%",
        caption: "이 수치에 대한 설명을 여기에 작성하세요.",
        source: "출처: 관리자 입력 필요",
      };
    case "news_briefing":
      return {
        englishLabel: "News Briefing",
        items: [
          { categoryTag: "분류", title: "제목 1 — 관리자가 입력", body: "본문 1을 여기에 작성하세요.", insight: { label: "MICE 연결", text: "MICE 함의를 작성" } },
          { categoryTag: "분류", title: "제목 2 — 관리자가 입력", body: "본문 2를 여기에 작성하세요.", insight: { label: "MICE 연결", text: "MICE 함의를 작성" } },
          { categoryTag: "분류", title: "제목 3 — 관리자가 입력", body: "본문 3을 여기에 작성하세요.", insight: { label: "MICE 연결", text: "MICE 함의를 작성" } },
        ],
      };
    case "in_out_comparison":
      return {
        englishLabel: "MICE IN & OUT",
        inItem: { categoryTag: "IN · 국내", title: "국내 소식 제목", body: "국내 소식 본문을 작성하세요.", source: "출처" },
        outItem: { categoryTag: "OUT · 글로벌", title: "해외 소식 제목", body: "해외 소식 본문을 작성하세요.", source: "출처" },
      };
    case "tech_signal":
      return {
        englishLabel: "Tech Signal",
        topicLabel: "토픽명",
        topicMeta: "",
        title: "제목을 여기에 작성하세요.",
        paragraphs: ["본문 단락을 작성하세요."],
        miceInsight: "MICE 관점 인사이트를 작성하세요.",
      };
    case "theory_to_field":
      return {
        englishLabel: "From Theory to Field",
        sourceYear: "",
        sourceAuthor: "",
        sourceMeta: "",
        title: "이론·연구의 헤드라인",
        introParagraphs: ["이론 소개 단락을 작성하세요."],
        bridge: { label: "→ 현장에서는", text: "현장 적용 한두 문장을 작성하세요." },
        outroParagraphs: ["마무리 단락을 작성하세요."],
        closingNote: "클로징 한 줄을 작성하세요.",
      };
    case "editor_take":
      return {
        englishLabel: "지금 MICE는",
        eyebrow: "이달의 이슈",
        title: "칼럼 타이틀",
        leadParagraph: "진입 문장을 작성하세요.",
        pullQuote: "인용구를 작성하세요.",
        paragraphs: ["본문 단락을 작성하세요."],
        closingNote: "클로징을 작성하세요.",
      };
    case "groundk_story":
      return {
        englishLabel: "GroundK Story",
        fieldBriefing: {
          eyebrow: "이달의 현장 브리핑",
          categoryTag: "운영 카테고리",
          body: "현장 브리핑 내용을 여기에 작성하세요.",
        },
        projectSketch: {
          projectMeta: "Project · 이름",
          dateMeta: "YYYY.MM.DD",
          eyebrow: "그라운드케이 프로젝트 스케치",
          title: "프로젝트 타이틀",
          paragraphs: [
            "첫 번째 단락을 작성하세요.",
            "두 번째 단락을 작성하세요.",
            "세 번째 단락을 작성하세요.",
          ],
          tags: ["태그1", "태그2", "태그3"],
        },
      };
    case "consolidated_insight":
      return {
        englishLabel: "GroundK Insight",
        parts: [
          {
            categoryTag: "테마 1",
            title: "제목 1",
            paragraphs: ["본문 단락을 작성하세요."],
            insight: { text: "Insight 본문 작성" },
          },
          {
            categoryTag: "테마 2",
            title: "제목 2",
            paragraphs: ["본문 단락을 작성하세요."],
            insight: { text: "Insight 본문 작성" },
          },
        ],
      };
    case "blog_card_grid":
      return {
        englishLabel: "GroundK Blog",
        cards: [
          { label: "Field Note", title: "카드 제목 1", description: "카드 설명 1을 작성하세요.", linkUrl: "https://blog.naver.com/groundk" },
          { label: "Project Story", title: "카드 제목 2", description: "카드 설명 2을 작성하세요.", linkUrl: "https://blog.naver.com/groundk" },
        ],
      };
  }
}

// ─────────────────────────────────────────────
// Per-block Claude generation
// ─────────────────────────────────────────────

interface BlockGenContext {
  issueLabel: string;
  referenceNotes?: string;
  articles: Article[]; // pre-filtered, may be empty
  instructions?: string;
  autoSearch: boolean;
}

function formatArticleForPrompt(a: Article, idx: number): string {
  const parts = [
    `[${idx + 1}] ${a.title}`,
    a.source ? `    출처: ${a.source}` : null,
    a.published_at ? `    발행: ${a.published_at.slice(0, 10)}` : null,
    a.summary ? `    요약: ${a.summary}` : null,
    a.tags.length > 0 ? `    태그: ${a.tags.join(", ")}` : null,
    `    URL: ${a.url}`,
  ].filter(Boolean);
  return parts.join("\n");
}

function buildBlockSystemPrompt(type: BlockType): string {
  return `당신은 "PIK" 뉴스레터 편집자입니다. 한국 MICE 산업 종사자 대상의 인사이트 레터입니다.

## 역할
단 하나의 블록(${type}) 콘텐츠를 JSON으로 생성합니다.

## 톤앤매너
- 한국어 평어체 (~다 / ~입니다 혼용 자연스럽게)
- 정보 전달 + MICE 산업 함의 균형
- 근거 약한 추측은 "~로 보인다" 형태
- 본문 안 \`**굵게**\` 마크업으로 핵심 키워드 강조 가능

## 출력 스키마 (이 JSON 객체만 출력, 마크다운 코드블록 금지)
${BLOCK_SCHEMA_PROMPT[type]}`;
}

function buildBlockUserMessage(
  type: BlockType,
  ctx: BlockGenContext
): string {
  const parts: string[] = [];
  parts.push(`# 호 정보`);
  parts.push(`issueLabel: ${ctx.issueLabel}`);
  parts.push("");

  if (ctx.autoSearch && ctx.articles.length > 0) {
    parts.push(`# 후보 기사 (이 중에서 선택/재구성)`);
    ctx.articles.forEach((a, i) =>
      parts.push(formatArticleForPrompt(a, i))
    );
    parts.push("");
  } else if (ctx.autoSearch) {
    parts.push(`# 후보 기사 없음 — 합리적인 내용으로 작성`);
    parts.push("");
  } else {
    parts.push(
      `# 자동 검색 OFF — 후보 기사를 참조하지 말고, 아래 "관리자 지시"와 일반 지식으로 작성. 지시가 없다면 의미 있는 placeholder 텍스트로 채워 관리자가 나중에 편집할 수 있도록.`
    );
    parts.push("");
  }

  if (ctx.referenceNotes && ctx.referenceNotes.trim().length > 0) {
    parts.push(`# 전체 사전 레퍼런스`);
    parts.push(ctx.referenceNotes.trim());
    parts.push("");
  }

  if (ctx.instructions && ctx.instructions.trim().length > 0) {
    parts.push(`# 이 블록에 대한 관리자 지시 (최우선 반영)`);
    parts.push(ctx.instructions.trim());
    parts.push("");
  }

  parts.push(
    `# 출력\n위 시스템 프롬프트의 스키마대로 단일 JSON 객체만 출력. 설명·마크다운 금지.`
  );
  return parts.join("\n");
}

function extractJson(raw: string): unknown {
  let jsonString = raw.trim();
  const fenced = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    jsonString = fenced[1].trim();
  } else {
    const first = jsonString.indexOf("{");
    const last = jsonString.lastIndexOf("}");
    if (first !== -1 && last > first) {
      jsonString = jsonString.slice(first, last + 1);
    }
  }
  return JSON.parse(jsonString);
}

async function generateBlockData(
  type: BlockType,
  ctx: BlockGenContext
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  // Fast path: autoSearch=false with no instructions → skip the API call entirely
  if (!ctx.autoSearch && (!ctx.instructions || ctx.instructions.trim() === "")) {
    return { ok: true, data: getPlaceholderData(type) };
  }

  const client = getClaudeClient();
  const schema = BLOCK_DATA_SCHEMAS[type];

  try {
    const response = await client.messages.create({
      model: DRAFT_MODEL,
      max_tokens: 2000,
      system: buildBlockSystemPrompt(type),
      messages: [{ role: "user", content: buildBlockUserMessage(type, ctx) }],
    });

    const textBlocks = response.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text);
    const raw = textBlocks.join("").trim();

    let parsed: unknown;
    try {
      parsed = extractJson(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `JSON 파싱 실패: ${msg}. 응답: ${raw.slice(0, 200)}`,
      };
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return { ok: false, error: `스키마 검증 실패: ${issues}` };
    }

    return { ok: true, data: result.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export interface BlockInstructionEntry {
  type: BlockType;
  instructions?: string;
  autoSearch: boolean;
}

export interface DraftGenerationInput {
  issueLabel: string;
  articlesByCategory: Record<ArticleCategory, Article[]>;
  referenceNotes?: string;
  blockTypes?: BlockType[];
  blockInstructions?: BlockInstructionEntry[];
}

export interface DraftGenerationResult {
  content: NewsletterContent;
  usedArticleIds: string[];
  /** Types of blocks that failed to generate (filled with placeholder). */
  failedBlocks: Array<{ type: BlockType; error: string }>;
}

function getArticlesForBlock(
  type: BlockType,
  articlesByCategory: Record<ArticleCategory, Article[]>
): Article[] {
  const cats = BLOCK_RELEVANT_CATEGORIES[type];
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const cat of cats) {
    for (const a of articlesByCategory[cat] ?? []) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
    }
  }
  return out;
}

/**
 * Generate a newsletter draft by running one Claude call per block in
 * parallel. This keeps each call small enough to fit inside Vercel's 60s
 * function timeout even when the issue has many blocks.
 */
export async function generateNewsletterDraft(
  input: DraftGenerationInput
): Promise<DraftGenerationResult> {
  const blockTypes = input.blockTypes ?? DEFAULT_BLOCK_TYPES;
  const instructionMap = new Map<BlockType, BlockInstructionEntry>();
  if (input.blockInstructions) {
    for (const e of input.blockInstructions) instructionMap.set(e.type, e);
  }

  // Kick off per-block generation in parallel
  const results = await Promise.all(
    blockTypes.map((type) => {
      const cfg = instructionMap.get(type);
      const ctx: BlockGenContext = {
        issueLabel: input.issueLabel,
        referenceNotes: input.referenceNotes,
        articles: cfg?.autoSearch === false
          ? []
          : getArticlesForBlock(type, input.articlesByCategory),
        instructions: cfg?.instructions,
        autoSearch: cfg?.autoSearch ?? true,
      };
      return generateBlockData(type, ctx);
    })
  );

  // Assemble block instances; placeholder + record error for any failures
  const failedBlocks: Array<{ type: BlockType; error: string }> = [];
  const blocks: BlockInstance[] = blockTypes.map((type, i) => {
    const r = results[i];
    const id = `b${i + 1}`;
    if (r.ok) {
      return { id, type, data: r.data } as BlockInstance;
    }
    failedBlocks.push({ type, error: r.error });
    return { id, type, data: getPlaceholderData(type) } as BlockInstance;
  });

  // Build a subject deterministically from the issueLabel
  const subject = `[PIK] ${input.issueLabel}`;

  const content: NewsletterContent = {
    issueLabel: input.issueLabel,
    subject,
    header: { ...PIK_HEADER, issueMeta: input.issueLabel },
    referralCta: REFERRAL_CTA_DEFAULT,
    blocks,
    footer: FOOTER_DEFAULT,
  };

  const usedArticleIds = Object.values(input.articlesByCategory)
    .flat()
    .map((a) => a.id);

  return { content, usedArticleIds, failedBlocks };
}
