/**
 * Newsletter content schema (content_json column on the newsletters table).
 *
 * Stored as JSONB. The Newsletter React Email component renders this shape
 * into HTML. The Studio UI lets admins edit individual sections, and Claude
 * can produce/modify any subset of these fields.
 */

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

/** A row in the `newsletters` table */
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

export interface NewsletterContent {
  /** Issue date e.g. "2026.04" or "VOL.01 · 2026년 4월호" */
  issueLabel: string;

  /** Email subject line (also visible in inbox preview) */
  subject: string;

  header: HeaderContent;
  referralCta: ReferralCtaContent;
  openingHook: OpeningHookContent;
  numberOfMonth: NumberOfMonthContent;
  newsBriefing: BriefingSection;
  miceInOut: MiceInOutContent;
  techSignal: TechSignalContent;
  theoryToField: TheoryToFieldContent;
  nowMice: NowMiceContent;
  groundkStory: GroundkStoryContent;
  footer: FooterContent;
}

// ─────────────────────────────────────────────
// 1. Header — SPEAK wordmark style
// ─────────────────────────────────────────────
export interface HeaderContent {
  /** Small grey text above the wordmark — e.g. "보이지 않던 것들을 말해드립니다." */
  topMessage: string;
  /** Big wordmark — typically "SPEAK" */
  wordmark: string;
  /**
   * Subtitle expansion. Each `boldChar` letter inside `subtitle` gets bolded
   * to spell out the wordmark acronym. e.g.
   *   subtitle = "Stories People in micE Always Know | by GroundK"
   *   boldIndices = [0, 8, 18, 20, 27]  // positions of S, P, E, A, K
   */
  subtitle: string;
  /** Indices in `subtitle` to render bold (acronym letters) */
  boldIndices: number[];
}

// ─────────────────────────────────────────────
// 2. Referral CTA (compact horizontal)
// ─────────────────────────────────────────────
export interface ReferralCtaContent {
  message: string;
  buttonLabel: string;
  buttonHref: string;
}

// ─────────────────────────────────────────────
// 3. Opening hook
// ─────────────────────────────────────────────
export interface OpeningHookContent {
  hook: string;
  subtext?: string;
}

// ─────────────────────────────────────────────
// 4. Number of the Month
// ─────────────────────────────────────────────
export interface NumberOfMonthContent {
  number: string;
  suffix?: string;
  caption: string;
  source: string;
}

// ─────────────────────────────────────────────
// 5. News Briefing — multiple items
// ─────────────────────────────────────────────
export interface BriefingSection {
  englishLabel: string;
  items: BriefingItem[];
}

export interface BriefingItem {
  categoryTag: string;
  title: string;
  body: string;
  insight?: {
    label?: string;
    text: string;
  };
  sourceUrl?: string;
}

// ─────────────────────────────────────────────
// 6. MICE IN & OUT — 2-column (IN / OUT)
// ─────────────────────────────────────────────
export interface MiceInOutContent {
  englishLabel: string;
  inItem: MiceInOutCard; // 국내
  outItem: MiceInOutCard; // 글로벌
}

export interface MiceInOutCard {
  /** Sub-category like "정책", "산업 동향" */
  categoryTag: string;
  title: string;
  body: string;
  source?: string;
}

// ─────────────────────────────────────────────
// 7. TECH SIGNAL — dark inverted card with single feature
// ─────────────────────────────────────────────
export interface TechSignalContent {
  englishLabel: string;
  /** Topic eyebrow like "Agentic AI" */
  topicLabel: string;
  /** Right-aligned meta line like "2026.04 · 이번 달 가장 뜨거운 기술 이슈" */
  topicMeta?: string;
  /** Headline */
  title: string;
  /** Body paragraphs (1-3) */
  paragraphs: string[];
  /** MICE perspective insight */
  miceInsight: string;
}

// ─────────────────────────────────────────────
// 8. From Theory to Field — long-form story
// ─────────────────────────────────────────────
export interface TheoryToFieldContent {
  englishLabel: string;
  /** Year/origin of the theory like "1990" */
  sourceYear?: string;
  /** Author + institution like "얀 비외르크 / 카롤린스카 연구소" */
  sourceAuthor?: string;
  /** Optional Latin/sub-label like "Circadian Rhythm & Cognitive Performance, Stockholm" */
  sourceMeta?: string;
  /** Big title */
  title: string;
  /** Intro narrative paragraphs */
  introParagraphs: string[];
  /** Bridge box (the "→ 현장에서는" connector) */
  bridge: {
    label?: string;
    text: string;
  };
  /** Outro paragraphs after the bridge */
  outroParagraphs: string[];
  /** Optional italic closing line */
  closingNote?: string;
}

// ─────────────────────────────────────────────
// 9. 지금 MICE는 — opinion piece
// ─────────────────────────────────────────────
export interface NowMiceContent {
  englishLabel: string;
  /** Eyebrow like "이달의 이슈" */
  eyebrow?: string;
  title: string;
  /** Lead-in paragraph before the pull quote */
  leadParagraph?: string;
  /** Optional pull quote */
  pullQuote?: string;
  /** Body paragraphs */
  paragraphs: string[];
  /** Optional italic closing note */
  closingNote?: string;
}

// ─────────────────────────────────────────────
// 10. GroundK Story — Field Briefing + Project Sketch
// ─────────────────────────────────────────────
export interface GroundkStoryContent {
  englishLabel: string;
  fieldBriefing: FieldBriefingItem;
  projectSketch: ProjectSketchItem;
}

export interface FieldBriefingItem {
  /** Subhead like "이달의 현장 브리핑" */
  eyebrow: string;
  /** Topic tag like "공항 운영" */
  categoryTag: string;
  /** Body (can include a strong highlight) */
  body: string;
}

export interface ProjectSketchItem {
  /** "Project" / project name like "COS" */
  projectMeta: string;
  /** Date like "2026.03.25" */
  dateMeta: string;
  /** Eyebrow like "그라운드케이 프로젝트 스케치" */
  eyebrow: string;
  /** Headline */
  title: string;
  /** Multiple paragraphs */
  paragraphs: string[];
  /** Tag chips at the bottom */
  tags: string[];
}

// ─────────────────────────────────────────────
// 11. Footer
// ─────────────────────────────────────────────
export interface FooterContent {
  brandName: string;
  links: Array<{ label: string; href: string }>;
  unsubscribeHref: string;
  logoSrc?: string;
}
