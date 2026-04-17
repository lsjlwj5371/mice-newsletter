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

/**
 * Canonical English labels per block type. These are enforced server-side
 * AFTER Claude output so the section headers never drift between
 * generations (e.g. Claude sometimes wrote "MICE IN APRIL" instead of
 * "MICE IN & OUT"). opening_lede is unnumbered and has no label.
 */
const CANONICAL_ENGLISH_LABELS: Partial<Record<BlockType, string>> = {
  stat_feature: "Number of the Month",
  news_briefing: "News Briefing",
  in_out_comparison: "MICE IN & OUT",
  tech_signal: "Tech Signal",
  theory_to_field: "From Theory to Field",
  editor_take: "지금 MICE는",
  groundk_story: "GroundK Story",
  consolidated_insight: "GroundK Insight",
  blog_card_grid: "GroundK Blog",
};

function applyCanonicalLabel(type: BlockType, data: unknown): unknown {
  const canonical = CANONICAL_ENGLISH_LABELS[type];
  if (!canonical) return data;
  if (data && typeof data === "object") {
    return { ...(data as Record<string, unknown>), englishLabel: canonical };
  }
  return data;
}

// ─────────────────────────────────────────────
// Per-block schemas (for Claude prompt + validation)
// ─────────────────────────────────────────────

const BLOCK_SCHEMA_PROMPT: Record<BlockType, string> = {
  opening_lede: `{ "hook": "2~4줄의 한 호 테마 압축 메시지. \\n으로 줄바꿈", "subtext": "1~2문장의 보충 설명 (선택)" }`,
  stat_feature: `{ "englishLabel": "Number of the Month", "number": "숫자만 (예: 73)", "suffix": "% 또는 단위 (선택)", "caption": "1~2문장. 수치의 의미를 설명합니다.", "source": "제공된 기사의 실제 출처 + 비교 수치가 있다면 함께" }`,
  news_briefing: `{ "englishLabel": "News Briefing", "items": [정확히 3개. 각 item = { "categoryTag": "경제 · 산업 등", "title": "14~28자의 헤드라인", "body": "2~3문장", "insight": { "label": "MICE 연결", "text": "1~2문장의 MICE 산업 함의" }, "sourceUrl": "제공된 기사의 실제 URL" }] }`,
  in_out_comparison: `{ "englishLabel": "MICE IN & OUT", "inItem": { "categoryTag": "IN · 국내", "title": "한국 관련 소식 제목", "body": "2~3문장", "source": "제공된 기사의 실제 출처명 (예: 한국관광공사 보도자료, 2026.04)" }, "outItem": { "categoryTag": "OUT · 글로벌", "title": "해외 관련 소식 제목", "body": "2~3문장", "source": "제공된 기사의 실제 출처명" } }`,
  tech_signal: `{ "englishLabel": "Tech Signal", "topicLabel": "Agentic AI 등 키워드", "topicMeta": "YYYY.MM · 이번 달 가장 뜨거운 기술 이슈", "title": "헤드라인", "paragraphs": ["1~2개의 단락"], "miceInsight": "1~2문장" }`,
  theory_to_field: `{ "englishLabel": "From Theory to Field", "sourceYear": "제공된 기사에 명시된 연도 (예: 1990). 없으면 빈 문자열", "sourceAuthor": "제공된 기사에 명시된 저자 / 소속. 없으면 빈 문자열", "sourceMeta": "영문 부제가 있다면. 없으면 빈 문자열", "title": "호기심을 자극하는 헤드라인", "introParagraphs": ["1~2단락"], "bridge": { "label": "→ 현장에서는", "text": "1~2문장" }, "outroParagraphs": ["1단락"], "closingNote": "1문장의 마무리" }`,
  editor_take: `{ "englishLabel": "지금 MICE는", "eyebrow": "이달의 이슈", "title": "\\n으로 줄바꿈 가능한 제목", "leadParagraph": "진입 1문장", "pullQuote": "짧고 강렬한 인용구", "paragraphs": ["2~3단락"], "closingNote": "1문장의 마무리" }`,
  groundk_story: `{ "englishLabel": "GroundK Story", "fieldBriefing": { "eyebrow": "이달의 현장 브리핑", "categoryTag": "공항 운영 등", "body": "1~2단락. 줄바꿈은 \\n\\n 로 구분" }, "projectSketch": { "projectMeta": "Project · 이름", "dateMeta": "YYYY.MM.DD", "eyebrow": "그라운드케이 프로젝트 스케치", "title": "프로젝트 타이틀", "paragraphs": ["정확히 3개의 단락"], "tags": ["태그 3개 정도"] } }`,
  consolidated_insight: `{ "englishLabel": "GroundK Insight", "parts": [2~4개. 각 part = { "categoryTag": "테마 카테고리", "title": "타이틀", "paragraphs": ["2~4단락"], "insight": { "text": "1~2문장" } }] }`,
  blog_card_grid: `{ "englishLabel": "GroundK Blog", "cards": [2~6개. 각 card = { "label": "Field Note / Project Story / Industry Insight / Tech & MICE 중 하나", "title": "제목", "description": "2~3줄의 설명", "linkUrl": "https://blog.naver.com/groundk" }] }`,
};

/**
 * Per-block article sourcing policy.
 *
 * - `primary`: preferred categories for this block
 * - `fallback`: secondary categories used when primary is sparse or empty
 *   (the admin may only have registered general `news` feeds — we still
 *   want tech_signal / in_out_comparison to find usable articles)
 * - `ignoreDateFilter`: when true, load articles regardless of the issue's
 *   collection period. Useful for theory_to_field where academic research
 *   is timeless.
 * - `limit`: hard cap on total articles passed to Claude for this block.
 */
interface BlockArticlePolicy {
  primary: ArticleCategory[];
  fallback: ArticleCategory[];
  ignoreDateFilter: boolean;
  limit: number;
}

const BLOCK_ARTICLE_POLICY: Record<BlockType, BlockArticlePolicy> = {
  opening_lede: {
    primary: [],
    fallback: [],
    ignoreDateFilter: false,
    limit: 0,
  },
  stat_feature: {
    // "이달의 숫자" — good stat can come from any time period, so we
    // read all-time like theory_to_field. Keeps statistic quality high
    // even for issues with a narrow collection window.
    primary: ["stat_feature", "news_briefing", "tech_signal", "in_out_comparison"],
    fallback: ["theory_to_field", "consolidated_insight"],
    ignoreDateFilter: true,
    limit: 10,
  },
  news_briefing: {
    primary: ["news_briefing"],
    fallback: ["in_out_comparison", "tech_signal"],
    ignoreDateFilter: false,
    limit: 10,
  },
  in_out_comparison: {
    primary: ["in_out_comparison"],
    fallback: ["news_briefing"],
    ignoreDateFilter: false,
    limit: 10,
  },
  tech_signal: {
    primary: ["tech_signal"],
    fallback: ["news_briefing"],
    ignoreDateFilter: false,
    limit: 10,
  },
  theory_to_field: {
    // Academic/research material: broaden the pool so Claude has options,
    // and ignore the issue's date filter because theory is timeless.
    primary: ["theory_to_field"],
    fallback: [
      "news_briefing",
      "tech_signal",
      "in_out_comparison",
      "consolidated_insight",
    ],
    ignoreDateFilter: true,
    limit: 15,
  },
  editor_take: {
    // Admin-authored column. Category exists for organization but block
    // itself doesn't auto-search.
    primary: [],
    fallback: [],
    ignoreDateFilter: false,
    limit: 0,
  },
  groundk_story: {
    // Admin-only content. Category tag is optional for organization.
    primary: [],
    fallback: [],
    ignoreDateFilter: false,
    limit: 0,
  },
  consolidated_insight: {
    primary: [
      "consolidated_insight",
      "news_briefing",
      "in_out_comparison",
      "tech_signal",
      "theory_to_field",
    ],
    fallback: [],
    ignoreDateFilter: false,
    limit: 12,
  },
  blog_card_grid: {
    // Admin-curated external blog cards — no article pool.
    primary: [],
    fallback: [],
    ignoreDateFilter: false,
    limit: 0,
  },
};

// Back-compat re-export (some callers still reference this name)
const BLOCK_RELEVANT_CATEGORIES: Record<BlockType, ArticleCategory[]> =
  Object.fromEntries(
    (Object.keys(BLOCK_ARTICLE_POLICY) as BlockType[]).map((t) => [
      t,
      [
        ...BLOCK_ARTICLE_POLICY[t].primary,
        ...BLOCK_ARTICLE_POLICY[t].fallback,
      ],
    ])
  ) as Record<BlockType, ArticleCategory[]>;

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
  return `당신은 "PIK" 뉴스레터의 전문 에디터입니다. 한국 MICE 산업 종사자를 대상으로 하는 격식 있는 인사이트 레터입니다.

## 역할
단 하나의 블록(${type}) 콘텐츠를 JSON으로 생성합니다.

## 톤앤매너 (매우 중요)
- 전문 에디터가 독자에게 말하듯, **격식 있는 문어체**로 작성합니다.
- 종결어미는 "~합니다 / ~입니다 / ~됩니다 / ~하겠습니다" 중심으로 통일합니다.
- "~다 / ~이다 / ~된다" 같은 평어체 단정형은 사용하지 않습니다.
- 정보 전달과 MICE 산업 관점의 인사이트를 균형 있게 담습니다.
- 근거가 약한 내용은 "~로 보입니다 / ~로 판단됩니다 / ~라는 관측이 있습니다" 형태로 완곡하게 표현합니다.
- 문장은 명료하고 간결하게. 불필요한 수식·형용사·부사는 덜어냅니다.

## 마크업 규칙 (매우 중요)
- **Markdown을 절대 사용하지 마십시오.** \`**bold**\`, \`*italic*\`, \`_강조_\` 같은 인라인 마크업 금지.
- 강조가 필요한 경우 **문장 구조**(짧은 단문 배치, 단락 첫 문장에 핵심 메시지)로 처리합니다. 디자인(글자색·굵기)은 서버의 렌더러가 담당하므로 텍스트에는 아무 마크업도 넣지 않습니다.
- 따옴표는 한국어 따옴표(" ")를 사용합니다. 영문 인용은 원문 그대로.

## 출력 규약
- 단일 JSON 객체만 출력. 마크다운 코드블록·설명·인사말 금지.
- 모든 문자열 값은 위 톤을 따릅니다.

## 출처 규칙 (매우 중요)
- 출처(URL, 연구자, 연도 등)는 제공된 후보 기사의 실제 정보에서만 가져옵니다.
- 제공되지 않은 출처를 **지어내지 마십시오**. 없으면 빈 문자열로 둡니다.
- 본문에 포함한 주장·수치·인용이 있다면, 그 근거는 반드시 제공된 기사 중 하나여야 합니다.

## 출력 스키마
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
    parts.push(
      `# 후보 기사 (반드시 이 중 하나 이상을 근거로 작성. 출처/URL은 이 기사들에서만 가져올 것)`
    );
    ctx.articles.forEach((a, i) =>
      parts.push(formatArticleForPrompt(a, i))
    );
    parts.push("");
  } else if (!ctx.autoSearch) {
    parts.push(
      `# 자동 검색 OFF — 후보 기사를 참조하지 않습니다. 아래 "관리자 지시"를 바탕으로, 전문 에디터가 현장 노트를 다듬어 원고를 완성한다는 느낌으로 작성하십시오. 출처 필드는 빈 문자열로 둡니다.`
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

/**
 * Blocks that MUST have real article references when auto-generated.
 * When the candidate article pool is empty for these types, we emit a
 * placeholder with a clear notice rather than letting Claude fabricate
 * content.
 */
const REFERENCE_REQUIRED_BLOCKS: Set<BlockType> = new Set([
  "news_briefing",
  "in_out_comparison",
  "tech_signal",
  "theory_to_field",
  "stat_feature",
  "consolidated_insight",
]);

/**
 * Blocks that should ONLY be generated from admin-provided input (never
 * auto-searched from the article pool). groundk_story is first-party
 * GroundK content, so Claude rewrites the admin's notes rather than
 * inventing the event.
 */
const ADMIN_ONLY_BLOCKS: Set<BlockType> = new Set(["groundk_story"]);

async function generateBlockData(
  type: BlockType,
  ctx: BlockGenContext
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  // Admin-only blocks require admin instructions. Without them, return a
  // placeholder so the user knows to supply source material.
  if (ADMIN_ONLY_BLOCKS.has(type)) {
    if (!ctx.instructions || ctx.instructions.trim() === "") {
      return {
        ok: true,
        data: applyCanonicalLabel(type, getPlaceholderData(type)),
      };
    }
    // Force autoSearch off so Claude never pulls from RSS for this block.
    ctx = { ...ctx, autoSearch: false, articles: [] };
  }

  // Reference-required blocks need at least one article when autoSearch is on.
  // Without references, we refuse to fabricate and return placeholder.
  if (
    ctx.autoSearch &&
    REFERENCE_REQUIRED_BLOCKS.has(type) &&
    ctx.articles.length === 0
  ) {
    return {
      ok: true,
      data: applyCanonicalLabel(type, getPlaceholderData(type)),
    };
  }

  // Fast path: autoSearch=false with no instructions → skip the API call entirely
  if (!ctx.autoSearch && (!ctx.instructions || ctx.instructions.trim() === "")) {
    return { ok: true, data: applyCanonicalLabel(type, getPlaceholderData(type)) };
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

    return { ok: true, data: applyCanonicalLabel(type, result.data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────
// Public per-block generator (used by the "regenerate this block" UX
// in the draft editor). Returns the data payload for a single block.
// ─────────────────────────────────────────────

export interface RegenerateBlockInput {
  type: BlockType;
  issueLabel: string;
  articles: Article[];
  instructions?: string;
  autoSearch: boolean;
  referenceNotes?: string;
}

export interface RegenerateBlockResult {
  data: unknown;
  referencedArticleIds: string[];
}

export async function regenerateSingleBlock(
  input: RegenerateBlockInput
): Promise<RegenerateBlockResult> {
  const ctx: BlockGenContext = {
    issueLabel: input.issueLabel,
    referenceNotes: input.referenceNotes,
    articles: input.autoSearch ? input.articles : [],
    instructions: input.instructions,
    autoSearch: input.autoSearch,
  };

  const result = await generateBlockData(input.type, ctx);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return {
    data: result.data,
    referencedArticleIds: ctx.articles.map((a) => a.id),
  };
}

export {
  getArticlesForBlock,
  BLOCK_RELEVANT_CATEGORIES,
  BLOCK_ARTICLE_POLICY,
};

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
  /** Articles already filtered by the issue's collection period. */
  articlesByCategory: Record<ArticleCategory, Article[]>;
  /**
   * Optional all-time article pool (no date filter). Supplied by the
   * caller when any block has ignoreDateFilter=true. When a block's
   * policy sets ignoreDateFilter, it reads from this pool instead of
   * articlesByCategory.
   */
  articlesByCategoryAllTime?: Record<ArticleCategory, Article[]>;
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

/**
 * Build a non-overlapping article pool for a single block, respecting an
 * externally-tracked set of IDs already claimed by other blocks. Articles
 * with pinned=true are always considered first so admin's "다음 호에서 써야 함"
 * flags win over normal priority.
 */
function getArticlesForBlock(
  type: BlockType,
  articlesByCategory: Record<ArticleCategory, Article[]>,
  articlesByCategoryAllTime?: Record<ArticleCategory, Article[]>,
  alreadyClaimed?: Set<string>
): Article[] {
  const policy = BLOCK_ARTICLE_POLICY[type];
  const pool =
    policy.ignoreDateFilter && articlesByCategoryAllTime
      ? articlesByCategoryAllTime
      : articlesByCategory;

  const claimed = alreadyClaimed ?? new Set<string>();
  const out: Article[] = [];

  function consume(cat: ArticleCategory, pinnedOnly: boolean) {
    for (const a of pool[cat] ?? []) {
      if (claimed.has(a.id)) continue;
      if (pinnedOnly && !a.pinned) continue;
      if (!pinnedOnly && a.pinned) continue; // already pulled via pinned pass
      out.push(a);
      claimed.add(a.id);
      if (out.length >= policy.limit) return true;
    }
    return false;
  }

  // Pass 1: pinned articles from primary (admin "must use")
  for (const cat of policy.primary) {
    if (consume(cat, true)) return out;
  }
  // Pass 2: pinned articles from fallback
  for (const cat of policy.fallback) {
    if (consume(cat, true)) return out;
  }
  // Pass 3: regular articles from primary
  for (const cat of policy.primary) {
    if (consume(cat, false)) return out;
  }
  // Pass 4: regular articles from fallback
  for (const cat of policy.fallback) {
    if (consume(cat, false)) return out;
  }

  return out;
}

/**
 * Partition articles across selected blocks so no single article appears
 * in more than one block's candidate pool. Blocks with the narrowest
 * primary categories get first pick; broader-scope blocks (like
 * consolidated_insight or stat_feature) take leftovers afterward.
 */
export function partitionArticlePools(
  blockTypes: BlockType[],
  articlesByCategory: Record<ArticleCategory, Article[]>,
  articlesByCategoryAllTime?: Record<ArticleCategory, Article[]>
): Partial<Record<BlockType, Article[]>> {
  // Priority order: narrowest primary first. Ties broken by alphabetical
  // block type to keep partitioning deterministic across runs.
  const order = [...blockTypes].sort((a, b) => {
    const pa = BLOCK_ARTICLE_POLICY[a].primary.length;
    const pb = BLOCK_ARTICLE_POLICY[b].primary.length;
    if (pa !== pb) return pa - pb;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const claimedDate = new Set<string>();
  const claimedAllTime = new Set<string>();
  const pools: Partial<Record<BlockType, Article[]>> = {};

  for (const type of order) {
    const policy = BLOCK_ARTICLE_POLICY[type];
    if (policy.primary.length === 0 && policy.fallback.length === 0) {
      // Article-less block (opening_lede, editor_take, groundk_story, etc.)
      continue;
    }
    const claimed = policy.ignoreDateFilter ? claimedAllTime : claimedDate;
    pools[type] = getArticlesForBlock(
      type,
      articlesByCategory,
      articlesByCategoryAllTime,
      claimed
    );
  }

  return pools;
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

  // Kick off per-block generation in parallel, remembering the article pool
  // used per block so it can be stored for the admin to review.
  // Partition articles up-front so each block's Claude call sees a
  // disjoint subset. This prevents the same article ending up in two
  // blocks' outputs.
  const autoSearchBlocks = blockTypes.filter((t) => {
    const cfg = instructionMap.get(t);
    return cfg?.autoSearch ?? true;
  });
  const partitioned = partitionArticlePools(
    autoSearchBlocks,
    input.articlesByCategory,
    input.articlesByCategoryAllTime
  );

  const perBlockContexts = blockTypes.map((type) => {
    const cfg = instructionMap.get(type);
    const autoSearch = cfg?.autoSearch ?? true;
    const articles = autoSearch ? partitioned[type] ?? [] : [];
    const ctx: BlockGenContext = {
      issueLabel: input.issueLabel,
      referenceNotes: input.referenceNotes,
      articles,
      instructions: cfg?.instructions,
      autoSearch,
    };
    return { type, ctx, cfg };
  });

  const results = await Promise.all(
    perBlockContexts.map(({ type, ctx }) => generateBlockData(type, ctx))
  );

  // Assemble block instances; placeholder + record error for any failures
  const failedBlocks: Array<{ type: BlockType; error: string }> = [];
  const blocks: BlockInstance[] = blockTypes.map((type, i) => {
    const r = results[i];
    const { ctx, cfg } = perBlockContexts[i];
    const id = `b${i + 1}`;
    const referencedArticleIds = ctx.articles.map((a) => a.id);
    const base = {
      id,
      type,
      referencedArticleIds,
      instructions: cfg?.instructions,
      autoSearch: cfg?.autoSearch,
    };
    if (r.ok) {
      return { ...base, data: r.data } as BlockInstance;
    }
    failedBlocks.push({ type, error: r.error });
    return {
      ...base,
      data: applyCanonicalLabel(type, getPlaceholderData(type)),
    } as BlockInstance;
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
