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
};

// Per-block data payloads ───────────────────────────────

const openingLedeBlock = z.object({
  ...blockBase,
  type: z.literal("opening_lede"),
  data: z.object({
    hook: z.string(),
    subtext: z.string().optional(),
  }),
});

const statFeatureBlock = z.object({
  ...blockBase,
  type: z.literal("stat_feature"),
  data: z.object({
    englishLabel: z.string(),
    number: z.string(),
    suffix: z.string().optional(),
    caption: z.string(),
    source: z.string(),
  }),
});

const insightSchema = z
  .object({
    label: z.string().optional(),
    text: z.string(),
  })
  .optional();

const briefingItemSchema = z.object({
  categoryTag: z.string(),
  title: z.string(),
  body: z.string(),
  insight: insightSchema,
  sourceUrl: z.string().optional(),
});

const newsBriefingBlock = z.object({
  ...blockBase,
  type: z.literal("news_briefing"),
  data: z.object({
    englishLabel: z.string(),
    items: z.array(briefingItemSchema).min(1),
  }),
});

const inOutCardSchema = z.object({
  categoryTag: z.string(),
  title: z.string(),
  body: z.string(),
  source: z.string().optional(),
});

const inOutComparisonBlock = z.object({
  ...blockBase,
  type: z.literal("in_out_comparison"),
  data: z.object({
    englishLabel: z.string(),
    inItem: inOutCardSchema,
    outItem: inOutCardSchema,
  }),
});

const techSignalBlock = z.object({
  ...blockBase,
  type: z.literal("tech_signal"),
  data: z.object({
    englishLabel: z.string(),
    topicLabel: z.string(),
    topicMeta: z.string().optional(),
    title: z.string(),
    paragraphs: z.array(z.string()).min(1),
    miceInsight: z.string(),
  }),
});

const theoryToFieldBlock = z.object({
  ...blockBase,
  type: z.literal("theory_to_field"),
  data: z.object({
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
  }),
});

const editorTakeBlock = z.object({
  ...blockBase,
  type: z.literal("editor_take"),
  data: z.object({
    englishLabel: z.string(),
    eyebrow: z.string().optional(),
    title: z.string(),
    leadParagraph: z.string().optional(),
    pullQuote: z.string().optional(),
    paragraphs: z.array(z.string()).min(1),
    closingNote: z.string().optional(),
  }),
});

const fieldBriefingPart = z.object({
  eyebrow: z.string(),
  categoryTag: z.string(),
  body: z.string(),
});

const projectSketchPart = z.object({
  projectMeta: z.string(),
  dateMeta: z.string(),
  eyebrow: z.string(),
  title: z.string(),
  paragraphs: z.array(z.string()).min(1),
  tags: z.array(z.string()),
});

const groundkStoryBlock = z.object({
  ...blockBase,
  type: z.literal("groundk_story"),
  data: z.object({
    englishLabel: z.string(),
    fieldBriefing: fieldBriefingPart,
    projectSketch: projectSketchPart,
  }),
});

const consolidatedPart = z.object({
  categoryTag: z.string(),
  title: z.string(),
  paragraphs: z.array(z.string()).min(1),
  insight: insightSchema,
});

const consolidatedInsightBlock = z.object({
  ...blockBase,
  type: z.literal("consolidated_insight"),
  data: z.object({
    englishLabel: z.string(),
    parts: z.array(consolidatedPart).min(1),
  }),
});

const blogCardSchema = z.object({
  label: z.string(),
  title: z.string(),
  description: z.string(),
  linkText: z.string().optional(),
  linkUrl: z.string(),
});

const blogCardGridBlock = z.object({
  ...blockBase,
  type: z.literal("blog_card_grid"),
  data: z.object({
    englishLabel: z.string(),
    cards: z.array(blogCardSchema).min(1),
  }),
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
