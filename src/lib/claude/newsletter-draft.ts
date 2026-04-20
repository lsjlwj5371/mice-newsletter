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
  consolidated_insight: `{ "englishLabel": "GroundK Insight", "topicLabel": "주제 태그 (예: Agentic AI · MICE 운영)", "topicMeta": "YYYY.MM · 심층 분석", "title": "이 호에서 다루는 하나의 심층 주제 제목 (24~40자)", "leadParagraph": "이 주제를 왜 지금 다루는지 설명하는 도입 단락 2~4문장", "chapters": [정확히 3~5개. 각 chapter = { "chapterLabel": "01 · 배경", "heading": "이 챕터에서 밝힐 질문/포인트 (14~28자)", "paragraphs": ["2~4개의 두터운 단락. 문장은 문어체 ~습니다 끝맺음."], "pullQuote": "(선택) 이 챕터에서 가장 강조하고 싶은 1문장. 생략 가능" }], "closingInsight": { "label": "GroundK Take", "text": "선택한 기사 한 건에서 도출한 결론 2~4문장. 단순 요약 금지, 실무자가 당장 취할 수 있는 의미까지 짚을 것." } }

## consolidated_insight 전용 지침 (매우 중요)
- 이 블록은 **여러 기사를 짜깁기하는 섹션이 아닙니다.** 후보 기사 중 **단 하나**(가장 MICE 업계에 파급력 있고 다층적으로 풀어낼 수 있는 기사)를 고르고, 그 **하나의 기사만을 심층 분석**합니다.
- 다른 후보 기사는 읽되 **본문에는 직접 인용하지 마십시오.** 배경 이해용 참고일 뿐입니다.
- 3~5개의 챕터는 **서로 다른 주제를 병렬 나열하는 것이 아니라**, 선택한 하나의 주제를 기승전결(배경 → 전개 → 파급 → 현장 적용) 흐름으로 심층 전개합니다.
- 각 챕터 본문은 **2~4개의 두터운 단락**으로 충분히 깊이 있게 씁니다. 분량이 길어지는 것은 환영합니다 — 얕은 설명을 여러 챕터에 흩뿌리는 것보다 한 챕터를 깊게 파는 편이 낫습니다.
- closingInsight(\`GroundK Take\`)는 **그 하나의 기사에서 GroundK가 직접 도출한 관점**입니다. 기사 요약 재진술이 아니라, "이 한 건의 소식이 MICE 실무에 어떤 결정을 요구하는가"까지 짚어야 합니다.
- \`_citedIndices\`는 본문에서 실제로 근거로 삼은 기사 **한 건의 번호**만 담습니다 (예: \`[3]\`). 배경 참고만 한 다른 기사는 포함하지 않습니다.`,
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
  /**
   * If true, this block pulls from the shared article pool WITHOUT claiming
   * articles away from other blocks. Used for synthesis blocks (e.g.
   * consolidated_insight) which should be allowed to re-draw from the same
   * sources other blocks reference, since their job is to synthesize across
   * topics rather than introduce distinct ones.
   */
  sharesPool?: boolean;
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
    // Output is a single stat + caption → Claude needs ~3 options.
    limit: 4,
  },
  news_briefing: {
    primary: ["news_briefing"],
    fallback: ["in_out_comparison", "tech_signal"],
    ignoreDateFilter: false,
    // Output is 3 items. 6 candidates = 2× choice ratio, leaves the rest
    // of the category pool for consolidated_insight / stat_feature.
    limit: 6,
  },
  in_out_comparison: {
    primary: ["in_out_comparison"],
    fallback: ["news_briefing"],
    ignoreDateFilter: false,
    // Output is 2 items (IN + OUT). 5 candidates gives enough to pair.
    limit: 5,
  },
  tech_signal: {
    primary: ["tech_signal"],
    fallback: ["news_briefing"],
    ignoreDateFilter: false,
    // Output is 1 topic. 3 candidates = enough to pick the best.
    limit: 3,
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
    // Output is 1 topic deep-dive. Broader pool helps surface the right
    // study, but cap still leaves plenty for other blocks.
    limit: 6,
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
    // Claude is instructed to pick ONE article from this pool and deep-
    // dive it, so the pool just needs enough variety for a good choice —
    // not maximal coverage. 6 is a practical sweet spot.
    limit: 6,
    // Exclusive partitioning: synthesis/deep-dive blocks must not re-surface
    // articles a peer block already claimed. Per-block limits are tuned so
    // news_briefing/tech_signal/etc leave a tail in each category that
    // consolidated_insight can draw on even though it partitions last.
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
        topicLabel: "주제 태그",
        topicMeta: "YYYY.MM · 심층 분석",
        title: "하나의 주제를 심층 분석하는 제목을 작성하세요.",
        leadParagraph:
          "이 주제를 왜 지금 다루는지 설명하는 도입 단락을 작성하세요.",
        chapters: [
          {
            chapterLabel: "01 · 배경",
            heading: "배경 챕터 제목",
            paragraphs: ["챕터 본문 단락을 작성하세요."],
          },
          {
            chapterLabel: "02 · 전개",
            heading: "전개 챕터 제목",
            paragraphs: ["챕터 본문 단락을 작성하세요."],
          },
          {
            chapterLabel: "03 · 현장 적용",
            heading: "현장 적용 챕터 제목",
            paragraphs: ["챕터 본문 단락을 작성하세요."],
          },
        ],
        closingInsight: {
          label: "GroundK Take",
          text: "우리 관점에서 도출한 결론을 작성하세요.",
        },
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

## 인용 추적 (필수)
- 출력 JSON의 **최상위에 \`_citedIndices\` 배열**을 반드시 포함합니다.
- 이 배열에는 본문 작성 과정에서 실제로 근거로 사용한 후보 기사 번호(제공된 \`[1]\`, \`[2]\`, ... 중)만 담습니다.
- 단순히 "참고는 했지만 본문에 반영되지 않은" 기사는 포함하지 마십시오.
- 예: 후보 기사 [1]~[10]을 주었는데 실제로 [3]과 [7]만 근거로 썼다면 \`"_citedIndices": [3, 7]\`.
- 어떤 기사도 근거로 쓰지 않았다면 \`"_citedIndices": []\`.

## 출력 스키마
${BLOCK_SCHEMA_PROMPT[type]}

위 스키마에 더해 최상위에 \`"_citedIndices": [...]\` 필드를 추가합니다.`;
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

interface BlockGenOk {
  ok: true;
  data: unknown;
  /**
   * 1-based indices (matching the `[1]`, `[2]`, ... prompt labels) that
   * Claude marked as ACTUALLY used as evidence. When null, the caller
   * should fall back to the full input pool — e.g. because Claude didn't
   * honor the `_citedIndices` contract, or the block didn't go through
   * the LLM path (placeholder / admin-only).
   */
  citedIndices: number[] | null;
}

type BlockGenResult = BlockGenOk | { ok: false; error: string };

async function generateBlockData(
  type: BlockType,
  ctx: BlockGenContext
): Promise<BlockGenResult> {
  // Admin-only blocks require admin instructions. Without them, return a
  // placeholder so the user knows to supply source material.
  if (ADMIN_ONLY_BLOCKS.has(type)) {
    if (!ctx.instructions || ctx.instructions.trim() === "") {
      return {
        ok: true,
        data: applyCanonicalLabel(type, getPlaceholderData(type)),
        citedIndices: [],
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
      citedIndices: [],
    };
  }

  // Fast path: autoSearch=false with no instructions → skip the API call entirely
  if (!ctx.autoSearch && (!ctx.instructions || ctx.instructions.trim() === "")) {
    return {
      ok: true,
      data: applyCanonicalLabel(type, getPlaceholderData(type)),
      citedIndices: [],
    };
  }

  const client = getClaudeClient();
  const schema = BLOCK_DATA_SCHEMAS[type];

  // consolidated_insight is now a long-form single-topic analysis with
  // 3~5 chapters each containing multi-paragraph body. It needs a higher
  // token cap than the 2000-token default that suits briefing-style blocks.
  const maxTokens = type === "consolidated_insight" ? 5000 : 2000;

  try {
    const response = await client.messages.create({
      model: DRAFT_MODEL,
      max_tokens: maxTokens,
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

    // Pull out the cited-article tracker before schema validation so the
    // zod schemas don't have to know about this meta field.
    let citedIndices: number[] | null = null;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const raw = obj._citedIndices;
      if (Array.isArray(raw)) {
        citedIndices = raw
          .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
          .map((n) => Math.trunc(n));
      }
      delete obj._citedIndices;
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return { ok: false, error: `스키마 검증 실패: ${issues}` };
    }

    return {
      ok: true,
      data: applyCanonicalLabel(type, result.data),
      citedIndices,
    };
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
    referencedArticleIds: resolveReferencedIds(ctx.articles, result.citedIndices),
  };
}

/**
 * Map Claude's `_citedIndices` (1-based) back to actual article IDs. When
 * Claude complied with the contract, this narrows the reference list to
 * only what the block actually used — so the draft editor no longer shows
 * a dozen articles for a section that really drew on one or two.
 *
 * Fallbacks:
 *   - citedIndices === null (Claude ignored the contract) → keep the full
 *     pool so admins can still see what was considered.
 *   - citedIndices === [] (explicitly nothing cited) → return empty. For
 *     reference-required blocks this will be rare; when it happens it's
 *     honest signalling that the block is admin-authored or placeholder.
 *   - citedIndices contains out-of-range numbers → those are silently
 *     dropped.
 */
function resolveReferencedIds(
  articles: Article[],
  citedIndices: number[] | null
): string[] {
  if (citedIndices === null) {
    return articles.map((a) => a.id);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const idx of citedIndices) {
    const article = articles[idx - 1]; // prompt uses 1-based labels
    if (!article) continue;
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    out.push(article.id);
  }
  return out;
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
  /**
   * Admin-specified article IDs for this block. When set and non-empty,
   * bypasses category/date partitioning and uses exactly these articles
   * as the candidate pool. The caller must also provide `forcedArticles`
   * (the resolved Article rows) alongside so Claude receives the full
   * metadata.
   */
  forcedArticleIds?: string[];
  forcedArticles?: Article[];
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

  // sharesPool blocks (e.g. consolidated_insight) ignore the claimed set —
  // they read the full pool so synthesis blocks still find articles even
  // when other blocks have partitioned their primary categories away.
  const claimed = policy.sharesPool ? new Set<string>() : (alreadyClaimed ?? new Set<string>());
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
  articlesByCategoryAllTime?: Record<ArticleCategory, Article[]>,
  /**
   * Article IDs already claimed externally (e.g. by blocks that have
   * admin-forced article picks). Treated as already-consumed for every
   * remaining block's partition — prevents the partition from handing
   * a forced article back to another block too.
   */
  externallyClaimed?: Set<string>
): Partial<Record<BlockType, Article[]>> {
  // Priority order: narrowest primary first. Ties broken by alphabetical
  // block type to keep partitioning deterministic across runs.
  const order = [...blockTypes].sort((a, b) => {
    const pa = BLOCK_ARTICLE_POLICY[a].primary.length;
    const pb = BLOCK_ARTICLE_POLICY[b].primary.length;
    if (pa !== pb) return pa - pb;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  // Seed both claimed sets with the externally-claimed IDs. These belong to
  // blocks that use forced-article picks — we don't know whether those
  // blocks partition from the date-filtered or all-time pool, so reserve
  // across both to be safe.
  const claimedDate = new Set<string>(externallyClaimed ?? []);
  const claimedAllTime = new Set<string>(externallyClaimed ?? []);
  const pools: Partial<Record<BlockType, Article[]>> = {};

  for (const type of order) {
    const policy = BLOCK_ARTICLE_POLICY[type];
    if (policy.primary.length === 0 && policy.fallback.length === 0) {
      // Article-less block (opening_lede, editor_take, groundk_story, etc.)
      continue;
    }

    if (policy.sharesPool) {
      // Synthesis block: draw from the full pool WITHOUT consuming — its
      // articles may overlap with other blocks' references. getArticlesForBlock
      // itself ignores the claimed set for these policies, so just read
      // without mutating claimedDate/claimedAllTime.
      pools[type] = getArticlesForBlock(
        type,
        articlesByCategory,
        articlesByCategoryAllTime
      );
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
  //
  // Two-tier candidate resolution:
  //   1. Blocks with forced-article picks use those exact articles.
  //      Those IDs are also added to an "externally claimed" set so the
  //      partition below won't reassign them to another block.
  //   2. Remaining auto-search blocks go through the usual exclusive
  //      partition so no article appears in more than one block's pool.
  const autoSearchBlocks = blockTypes.filter((t) => {
    const cfg = instructionMap.get(t);
    return cfg?.autoSearch ?? true;
  });

  const externallyClaimed = new Set<string>();
  for (const t of autoSearchBlocks) {
    const cfg = instructionMap.get(t);
    for (const id of cfg?.forcedArticleIds ?? []) externallyClaimed.add(id);
  }

  const blocksForPartition = autoSearchBlocks.filter((t) => {
    const cfg = instructionMap.get(t);
    return !cfg?.forcedArticleIds || cfg.forcedArticleIds.length === 0;
  });

  const partitioned = partitionArticlePools(
    blocksForPartition,
    input.articlesByCategory,
    input.articlesByCategoryAllTime,
    externallyClaimed
  );

  const perBlockContexts = blockTypes.map((type) => {
    const cfg = instructionMap.get(type);
    const autoSearch = cfg?.autoSearch ?? true;

    let articles: Article[] = [];
    if (autoSearch) {
      const forced = cfg?.forcedArticles ?? [];
      if (forced.length > 0) {
        articles = forced;
      } else {
        articles = partitioned[type] ?? [];
      }
    }

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
    // When Claude reported cited indices, narrow the reference list to
    // what was actually used. On failure (placeholder), there's no
    // reference list.
    const referencedArticleIds = r.ok
      ? resolveReferencedIds(ctx.articles, r.citedIndices)
      : [];
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
