import { z } from "zod";
import { BLOCK_TYPES } from "@/types/newsletter";

/**
 * Zod schema for the block-based newsletter content (schema_version = 2).
 * Keep in sync with src/types/newsletter.ts.
 */

// Fixed top/bottom sections ─────────────────────────────

const headerSchema = z.object({
  wordmark: z.string(),
  tagline: z.string(),
  industryTag: z.string(),
  issueMeta: z.string(),
  description: z.string(),
});

const referralCtaSchema = z.object({
  message: z.string(),
  buttonLabel: z.string(),
  buttonHref: z.string(),
});

const footerSchema = z.object({
  brandName: z.string(),
  brandTagline: z.string().optional(),
  links: z.array(z.object({ label: z.string(), href: z.string() })),
  unsubscribeHref: z.string(),
  logoSrc: z.string().optional(),
});

// Block-level shared wrapper ────────────────────────────
const blockBase = {
  id: z.string(),
  indexLabel: z.string().optional(),
  instructions: z.string().optional(),
  autoSearch: z.boolean().optional(),
  referencedArticleIds: z.array(z.string()).optional(),
};

// ─────────────────────────────────────────────
// Per-block DATA payload schemas (exported so the per-block Claude
// generator can validate individual block outputs without needing the
// full NewsletterContent envelope).
// ─────────────────────────────────────────────

export const openingLedeDataSchema = z.object({
  hook: z.string(),
  subtext: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const statFeatureDataSchema = z.object({
  englishLabel: z.string(),
  number: z.string(),
  suffix: z.string().optional(),
  caption: z.string(),
  source: z.string(),
  imageUrl: z.string().optional(),
});

const insightSchemaExported = z
  .object({
    label: z.string().optional(),
    text: z.string(),
  })
  .optional();

const briefingItemSchemaExported = z.object({
  categoryTag: z.string(),
  title: z.string(),
  body: z.string(),
  insight: insightSchemaExported,
  sourceUrl: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const newsBriefingDataSchema = z.object({
  englishLabel: z.string(),
  items: z.array(briefingItemSchemaExported).min(1),
});

const inOutCardSchemaExported = z.object({
  categoryTag: z.string(),
  title: z.string(),
  body: z.string(),
  source: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const inOutComparisonDataSchema = z.object({
  englishLabel: z.string(),
  inItem: inOutCardSchemaExported,
  outItem: inOutCardSchemaExported,
});

export const techSignalDataSchema = z.object({
  englishLabel: z.string(),
  topicLabel: z.string(),
  topicMeta: z.string().optional(),
  title: z.string(),
  paragraphs: z.array(z.string()).min(1),
  miceInsight: z.string(),
  imageUrl: z.string().optional(),
});

export const theoryToFieldDataSchema = z.object({
  englishLabel: z.string(),
  sourceYear: z.string().optional(),
  sourceAuthor: z.string().optional(),
  sourceMeta: z.string().optional(),
  title: z.string(),
  introParagraphs: z.array(z.string()).min(1),
  bridge: z.object({
    label: z.string().optional(),
    text: z.string(),
  }),
  outroParagraphs: z.array(z.string()).min(1),
  closingNote: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const editorTakeDataSchema = z.object({
  englishLabel: z.string(),
  eyebrow: z.string().optional(),
  title: z.string(),
  leadParagraph: z.string().optional(),
  pullQuote: z.string().optional(),
  paragraphs: z.array(z.string()).min(1),
  closingNote: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const groundkStoryDataSchema = z.object({
  englishLabel: z.string(),
  fieldBriefing: z.object({
    eyebrow: z.string(),
    categoryTag: z.string(),
    body: z.string(),
    imageUrl: z.string().optional(),
  }),
  projectSketch: z.object({
    projectMeta: z.string(),
    dateMeta: z.string(),
    eyebrow: z.string(),
    title: z.string(),
    paragraphs: z.array(z.string()).min(1),
    tags: z.array(z.string()),
    imageUrl: z.string().optional(),
  }),
});

export const consolidatedInsightDataSchema = z
  .object({
    englishLabel: z.string(),
    // ── New long-form single-topic shape ───────────────────
    topicLabel: z.string().optional(),
    topicMeta: z.string().optional(),
    title: z.string().optional(),
    leadParagraph: z.string().optional(),
    chapters: z
      .array(
        z.object({
          chapterLabel: z.string(), // "01 · 배경", "02 · 확산" …
          heading: z.string(),
          paragraphs: z.array(z.string()).min(1),
          pullQuote: z.string().optional(),
        })
      )
      .optional(),
    closingInsight: z
      .object({ label: z.string().optional(), text: z.string() })
      .optional(),
    imageUrl: z.string().optional(),
    // ── Legacy multi-theme shape (kept so older drafts still validate) ──
    parts: z
      .array(
        z.object({
          categoryTag: z.string(),
          title: z.string(),
          paragraphs: z.array(z.string()).min(1),
          insight: insightSchemaExported,
          imageUrl: z.string().optional(),
        })
      )
      .optional(),
  })
  .refine(
    (v) =>
      (v.chapters && v.chapters.length > 0) ||
      (v.parts && v.parts.length > 0),
    {
      message: "chapters 또는 parts 중 하나는 1개 이상 있어야 합니다.",
      path: ["chapters"],
    }
  );

export const blogCardGridDataSchema = z.object({
  englishLabel: z.string(),
  cards: z.array(
    z.object({
      label: z.string(),
      title: z.string(),
      description: z.string(),
      linkText: z.string().optional(),
      linkUrl: z.string(),
      imageUrl: z.string().optional(),
    })
  ).min(1),
});

/** Block data schema lookup — indexed by block type. */
export const BLOCK_DATA_SCHEMAS = {
  opening_lede: openingLedeDataSchema,
  stat_feature: statFeatureDataSchema,
  news_briefing: newsBriefingDataSchema,
  in_out_comparison: inOutComparisonDataSchema,
  tech_signal: techSignalDataSchema,
  theory_to_field: theoryToFieldDataSchema,
  editor_take: editorTakeDataSchema,
  groundk_story: groundkStoryDataSchema,
  consolidated_insight: consolidatedInsightDataSchema,
  blog_card_grid: blogCardGridDataSchema,
} as const;

// Per-block wrappers (unchanged contract, but now built on the exported
// data schemas above so there's a single source of truth)

const openingLedeBlock = z.object({
  ...blockBase,
  type: z.literal("opening_lede"),
  data: openingLedeDataSchema,
});

const statFeatureBlock = z.object({
  ...blockBase,
  type: z.literal("stat_feature"),
  data: statFeatureDataSchema,
});

const newsBriefingBlock = z.object({
  ...blockBase,
  type: z.literal("news_briefing"),
  data: newsBriefingDataSchema,
});

const inOutComparisonBlock = z.object({
  ...blockBase,
  type: z.literal("in_out_comparison"),
  data: inOutComparisonDataSchema,
});

const techSignalBlock = z.object({
  ...blockBase,
  type: z.literal("tech_signal"),
  data: techSignalDataSchema,
});

const theoryToFieldBlock = z.object({
  ...blockBase,
  type: z.literal("theory_to_field"),
  data: theoryToFieldDataSchema,
});

const editorTakeBlock = z.object({
  ...blockBase,
  type: z.literal("editor_take"),
  data: editorTakeDataSchema,
});

const groundkStoryBlock = z.object({
  ...blockBase,
  type: z.literal("groundk_story"),
  data: groundkStoryDataSchema,
});

const consolidatedInsightBlock = z.object({
  ...blockBase,
  type: z.literal("consolidated_insight"),
  data: consolidatedInsightDataSchema,
});

const blogCardGridBlock = z.object({
  ...blockBase,
  type: z.literal("blog_card_grid"),
  data: blogCardGridDataSchema,
});

export const blockInstanceSchema = z.discriminatedUnion("type", [
  openingLedeBlock,
  statFeatureBlock,
  newsBriefingBlock,
  inOutComparisonBlock,
  techSignalBlock,
  theoryToFieldBlock,
  editorTakeBlock,
  groundkStoryBlock,
  consolidatedInsightBlock,
  blogCardGridBlock,
]);

export const newsletterContentSchema = z.object({
  issueLabel: z.string(),
  subject: z.string(),
  header: headerSchema,
  referralCta: referralCtaSchema,
  blocks: z.array(blockInstanceSchema),
  footer: footerSchema,
});

export type NewsletterContentParsed = z.infer<typeof newsletterContentSchema>;

// Ensure BLOCK_TYPES stays in sync with the discriminated union
// (This is a compile-time sanity check for future maintainers.)
type _CheckBlockTypes = Exclude<
  (typeof BLOCK_TYPES)[number],
  z.infer<typeof blockInstanceSchema>["type"]
>;
// If you see an error on the line below, BLOCK_TYPES contains a literal that
// isn't handled in blockInstanceSchema above.
const _check: _CheckBlockTypes[] = [];
void _check;
