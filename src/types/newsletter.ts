/**
 * Newsletter content schema — BLOCK-BASED (schema_version = 2)
 *
 * A newsletter is: fixed header + fixed referralCta + [ordered blocks] + fixed footer
 *
 * Each block is a discrete content unit that the admin can mix-and-match per
 * issue. The `type` field drives which React Email component renders it and
 * what shape `data` must have.
 *
 * Stored as JSONB. The Newsletter React Email component iterates `blocks`
 * in order and renders each via a BLOCK_RENDERERS map keyed by `type`.
 */

// ─────────────────────────────────────────────
// Top-level
// ─────────────────────────────────────────────
export interface NewsletterContent {
  /** Issue date e.g. "VOL.01 · 2026년 4월호" */
  issueLabel: string;
  /** Email subject line (also visible in inbox preview) */
  subject: string;

  /** Fixed top sections */
  header: HeaderContent;
  referralCta: ReferralCtaContent;

  /** Ordered content blocks that vary per issue */
  blocks: BlockInstance[];

  /** Fixed bottom section */
  footer: FooterContent;
}

// ─────────────────────────────────────────────
// Block catalog
// ─────────────────────────────────────────────
export const BLOCK_TYPES = [
  "opening_lede",
  "stat_feature",
  "news_briefing",
  "in_out_comparison",
  "tech_signal",
  "theory_to_field",
  "editor_take",
  "groundk_story",
  "consolidated_insight",
  "blog_card_grid",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  opening_lede: "오프닝 훅",
  stat_feature: "이달의 숫자",
  news_briefing: "뉴스 브리핑 (3건)",
  in_out_comparison: "MICE IN & OUT",
  tech_signal: "TECH SIGNAL",
  theory_to_field: "이론에서 현장으로",
  editor_take: "지금 MICE는",
  groundk_story: "그라운드케이 스토리",
  consolidated_insight: "그라운드케이 인사이트 (심층, 2~4파트)",
  blog_card_grid: "블로그 카드 그리드",
};

export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  opening_lede: "호의 테마를 압축한 오프닝 메시지. 골드 좌측 보더 강조",
  stat_feature: "이번 달 주목할 수치 1개와 해설",
  news_briefing: "MICE 업계 주요 뉴스 3건 + 각 MICE 연결 인사이트",
  in_out_comparison: "국내(IN) 소식 1건 + 글로벌(OUT) 소식 1건 2단 카드",
  tech_signal: "MICE에 영향을 줄 기술 트렌드 1건 심층 분석",
  theory_to_field: "학술/연구를 현장 적용 관점으로 풀어냄",
  editor_take: "이달의 이슈 칼럼 + 풀아웃 인용",
  groundk_story: "Field Briefing(짧은 현장 브리핑) + Project Sketch(프로젝트 소개)",
  consolidated_insight: "Ver.2 스타일: 2~4개의 심층 분석을 한 섹션에 묶음",
  blog_card_grid: "외부 블로그 글을 카드로 소개 (2~6개)",
};

/**
 * Hint used by the Claude draft generator to know whether this block needs
 * external research (articles) or is purely narrative/admin-provided.
 */
export const BLOCK_NEEDS_RESEARCH: Record<BlockType, boolean> = {
  opening_lede: false,
  stat_feature: true,
  news_briefing: true,
  in_out_comparison: true,
  tech_signal: true,
  theory_to_field: true,
  editor_take: false,
  groundk_story: false,
  consolidated_insight: true,
  blog_card_grid: false,
};

// ─────────────────────────────────────────────
// Block instance
// Every block has the same wrapper shape: { type, indexLabel?, data, instructions?, autoSearch? }
// and a type-specific `data` payload.
// ─────────────────────────────────────────────
export type BlockInstance =
  | OpeningLedeBlock
  | StatFeatureBlock
  | NewsBriefingBlock
  | InOutComparisonBlock
  | TechSignalBlock
  | TheoryToFieldBlock
  | EditorTakeBlock
  | GroundkStoryBlock
  | ConsolidatedInsightBlock
  | BlogCardGridBlock;

interface BlockBase {
  /** Stable id for drag-drop + edit tracking. Generated client-side. */
  id: string;
  /** Optional section number like "01", "02". If omitted, renderer auto-numbers. */
  indexLabel?: string;
  /**
   * Free-text admin instruction for Claude when generating this block.
   * e.g. "이번 호는 ESG 관련만 다뤄", "분량 짧게", "후보 3개 주면 내가 고를게"
   */
  instructions?: string;
  /** If true, Claude should research/fill this block. If false, use data as-is. */
  autoSearch?: boolean;
  /**
   * Article IDs that were in the candidate pool passed to Claude when this
   * block was generated. Used in the draft editor to let the admin verify
   * Claude picked reasonable sources and to give per-block feedback.
   */
  referencedArticleIds?: string[];
}

export interface OpeningLedeBlock extends BlockBase {
  type: "opening_lede";
  data: {
    hook: string;
    subtext?: string;
  };
}

export interface StatFeatureBlock extends BlockBase {
  type: "stat_feature";
  data: {
    englishLabel: string; // "Number of the Month"
    number: string;
    suffix?: string;
    caption: string;
    source: string;
  };
}

export interface BriefingItem {
  categoryTag: string;
  title: string;
  body: string;
  insight?: { label?: string; text: string };
  sourceUrl?: string;
}

export interface NewsBriefingBlock extends BlockBase {
  type: "news_briefing";
  data: {
    englishLabel: string; // "News Briefing"
    items: BriefingItem[]; // default 3
  };
}

export interface MiceInOutCard {
  categoryTag: string;
  title: string;
  body: string;
  source?: string;
}

export interface InOutComparisonBlock extends BlockBase {
  type: "in_out_comparison";
  data: {
    englishLabel: string; // "MICE IN & OUT"
    inItem: MiceInOutCard;
    outItem: MiceInOutCard;
  };
}

export interface TechSignalBlock extends BlockBase {
  type: "tech_signal";
  data: {
    englishLabel: string; // "Tech Signal"
    topicLabel: string; // "Agentic AI"
    topicMeta?: string; // "2026.04 · 이번 달..."
    title: string;
    paragraphs: string[];
    miceInsight: string;
  };
}

export interface TheoryToFieldBlock extends BlockBase {
  type: "theory_to_field";
  data: {
    englishLabel: string; // "From Theory to Field"
    sourceYear?: string;
    sourceAuthor?: string;
    sourceMeta?: string;
    title: string;
    introParagraphs: string[];
    bridge: { label?: string; text: string };
    outroParagraphs: string[];
    closingNote?: string;
  };
}

export interface EditorTakeBlock extends BlockBase {
  type: "editor_take";
  data: {
    englishLabel: string; // "지금 MICE는" or "Editor's Take"
    eyebrow?: string;
    title: string;
    leadParagraph?: string;
    pullQuote?: string;
    paragraphs: string[];
    closingNote?: string;
  };
}

export interface FieldBriefingPart {
  eyebrow: string;
  categoryTag: string;
  body: string;
}

export interface ProjectSketchPart {
  projectMeta: string;
  dateMeta: string;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  tags: string[];
}

export interface GroundkStoryBlock extends BlockBase {
  type: "groundk_story";
  data: {
    englishLabel: string; // "GroundK Story"
    fieldBriefing: FieldBriefingPart;
    projectSketch: ProjectSketchPart;
  };
}

export interface ConsolidatedInsightPart {
  categoryTag: string;
  title: string;
  paragraphs: string[];
  insight?: { label?: string; text: string };
}

export interface ConsolidatedInsightBlock extends BlockBase {
  type: "consolidated_insight";
  data: {
    englishLabel: string; // "GroundK Insight"
    parts: ConsolidatedInsightPart[]; // 2~4
  };
}

export interface BlogCard {
  label: string;
  title: string;
  description: string;
  linkText?: string;
  linkUrl: string;
}

export interface BlogCardGridBlock extends BlockBase {
  type: "blog_card_grid";
  data: {
    englishLabel: string; // "GroundK Blog"
    cards: BlogCard[]; // 2~6
  };
}

// ─────────────────────────────────────────────
// Fixed sections
// ─────────────────────────────────────────────
export interface HeaderContent {
  /** Brand wordmark e.g. "PIK" */
  wordmark: string;
  /** Small tagline next to wordmark e.g. "We pick what moves you" */
  tagline: string;
  /** Industry tag e.g. "MICE · PCO · Event Industry" */
  industryTag: string;
  /** Issue meta line e.g. "VOL.01 · 2026년 4월호" */
  issueMeta: string;
  /** Extended description e.g. "업계 종사자를 위한 인사이트 레터 · by GroundK" */
  description: string;
}

export interface ReferralCtaContent {
  message: string;
  buttonLabel: string;
  buttonHref: string;
}

export interface FooterContent {
  brandName: string;
  brandTagline?: string;
  links: Array<{ label: string; href: string }>;
  unsubscribeHref: string;
  logoSrc?: string;
}

// ─────────────────────────────────────────────
// Newsletter row (DB)
// ─────────────────────────────────────────────
export const NEWSLETTER_STATUSES = [
  "draft",
  "review",
  "scheduled",
  "sent",
  "archived",
] as const;

export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number];

export const NEWSLETTER_STATUS_LABELS: Record<NewsletterStatus, string> = {
  draft: "초안",
  review: "감수 중",
  scheduled: "발송 예약",
  sent: "발송 완료",
  archived: "보관",
};

export interface NewsletterRow {
  id: string;
  issue_label: string;
  subject: string;
  status: NewsletterStatus;
  schema_version: number;
  content_json: NewsletterContent;
  collection_period_start: string | null;
  collection_period_end: string | null;
  reference_notes: string | null;
  used_article_ids: string[];
  scheduled_at: string | null;
  sent_at: string | null;
  rendered_html_snapshot: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_drafted_at: string;
}
