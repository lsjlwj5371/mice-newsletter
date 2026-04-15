/**
 * Newsletter content schema (content_json column on the newsletters table).
 *
 * Stored as JSONB. The Newsletter React Email component renders this shape
 * into HTML. The Studio UI lets admins edit individual sections, and Claude
 * can produce/modify any subset of these fields.
 */

export interface NewsletterContent {
  /** Issue date e.g. "2026.04" or "2026.04.15" */
  issueLabel: string;

  /** Email subject line (also visible in inbox preview) */
  subject: string;

  header: HeaderContent;
  referralCta: ReferralCtaContent;
  openingHook: OpeningHookContent;
  numberOfMonth: NumberOfMonthContent;
  newsBriefing: BriefingSection;
  miceInOut: BriefingSection;
  techSignal: BriefingSection;
  theoryToField: BriefingSection;
  nowMice: NowMiceContent;
  groundkStory: GroundkStorySection;
  footer: FooterContent;
}

export interface HeaderContent {
  /** Eyebrow text above the brand title — e.g. "MICE · PCO · Event Industry" */
  eyebrow: string;
  /** Brand title — e.g. "GROUND INSIGHT" */
  brandTitle: string;
  /** Tagline below the title */
  tagline: string;
}

export interface ReferralCtaContent {
  /** Short message shown to the left of the button */
  message: string;
  /** Button label e.g. "추천하기" */
  buttonLabel: string;
  /** Button target — will be replaced at send time with a tokenized URL */
  buttonHref: string;
}

export interface OpeningHookContent {
  /** Main hook lines (use \n for line breaks) */
  hook: string;
  /** Optional supporting paragraph below the hook */
  subtext?: string;
}

export interface NumberOfMonthContent {
  /** Numeric value e.g. "73" */
  number: string;
  /** Optional suffix e.g. "%" */
  suffix?: string;
  /** Caption explaining what the number means (markdown-lite: **bold**) */
  caption: string;
  /** Source/citation */
  source: string;
}

export interface BriefingSection {
  /** Section number "01" / "02" etc — auto-assigned by template if undefined */
  index?: string;
  /** English label e.g. "News Briefing" */
  englishLabel: string;
  items: BriefingItem[];
}

export interface BriefingItem {
  /** Category tag like "Macro & Economy" */
  categoryTag: string;
  /** Headline */
  title: string;
  /** Body text */
  body: string;
  /** Optional Insight box */
  insight?: {
    label?: string; // default "Insight"
    text: string;
  };
  /** Optional source URL displayed under body */
  sourceUrl?: string;
}

export interface NowMiceContent {
  /** Section index e.g. "06" */
  index?: string;
  englishLabel: string; // e.g. "Editor's Take" or "지금 MICE는"
  title: string;
  /** Optional pull-quote shown in italic with gold left border */
  pullQuote?: string;
  /** Body paragraphs */
  paragraphs: string[];
}

export interface GroundkStorySection {
  index?: string;
  englishLabel: string;
  items: GroundkStoryItem[];
}

export interface GroundkStoryItem {
  categoryTag: string;
  title: string;
  body: string;
  pills?: string[]; // small chip labels like "VIP 의전", "서울 · 2026.03"
}

export interface FooterContent {
  /** Display name — e.g. "GroundK" */
  brandName: string;
  /** Up to 4 link rows */
  links: Array<{ label: string; href: string }>;
  /** Unsubscribe link — replaced with tokenized URL at send time */
  unsubscribeHref: string;
  /** Logo image URL (relative or absolute). Defaults to /logo.png */
  logoSrc?: string;
}
