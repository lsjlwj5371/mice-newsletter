import { z } from "zod";

/**
 * Zod schema mirroring NewsletterContent in src/types/newsletter.ts.
 * Used to validate Claude's JSON output before saving to DB.
 *
 * Keep this in sync with src/types/newsletter.ts.
 */

const headerSchema = z.object({
  topMessage: z.string(),
  wordmark: z.string(),
  subtitle: z.string(),
  boldIndices: z.array(z.number().int().nonnegative()),
});

const referralCtaSchema = z.object({
  message: z.string(),
  buttonLabel: z.string(),
  buttonHref: z.string(),
});

const openingHookSchema = z.object({
  hook: z.string(),
  subtext: z.string().optional(),
});

const numberOfMonthSchema = z.object({
  number: z.string(),
  suffix: z.string().optional(),
  caption: z.string(),
  source: z.string(),
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

const briefingSectionSchema = z.object({
  englishLabel: z.string(),
  items: z.array(briefingItemSchema),
});

const miceInOutCardSchema = z.object({
  categoryTag: z.string(),
  title: z.string(),
  body: z.string(),
  source: z.string().optional(),
});

const miceInOutSchema = z.object({
  englishLabel: z.string(),
  inItem: miceInOutCardSchema,
  outItem: miceInOutCardSchema,
});

const techSignalSchema = z.object({
  englishLabel: z.string(),
  topicLabel: z.string(),
  topicMeta: z.string().optional(),
  title: z.string(),
  paragraphs: z.array(z.string()).min(1),
  miceInsight: z.string(),
});

const theoryToFieldSchema = z.object({
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
});

const nowMiceSchema = z.object({
  englishLabel: z.string(),
  eyebrow: z.string().optional(),
  title: z.string(),
  leadParagraph: z.string().optional(),
  pullQuote: z.string().optional(),
  paragraphs: z.array(z.string()).min(1),
  closingNote: z.string().optional(),
});

const fieldBriefingSchema = z.object({
  eyebrow: z.string(),
  categoryTag: z.string(),
  body: z.string(),
});

const projectSketchSchema = z.object({
  projectMeta: z.string(),
  dateMeta: z.string(),
  eyebrow: z.string(),
  title: z.string(),
  paragraphs: z.array(z.string()).min(1),
  tags: z.array(z.string()),
});

const groundkStorySchema = z.object({
  englishLabel: z.string(),
  fieldBriefing: fieldBriefingSchema,
  projectSketch: projectSketchSchema,
});

const footerSchema = z.object({
  brandName: z.string(),
  links: z.array(
    z.object({
      label: z.string(),
      href: z.string(),
    })
  ),
  unsubscribeHref: z.string(),
  logoSrc: z.string().optional(),
});

export const newsletterContentSchema = z.object({
  issueLabel: z.string(),
  subject: z.string(),
  header: headerSchema,
  referralCta: referralCtaSchema,
  openingHook: openingHookSchema,
  numberOfMonth: numberOfMonthSchema,
  newsBriefing: briefingSectionSchema,
  miceInOut: miceInOutSchema,
  techSignal: techSignalSchema,
  theoryToField: theoryToFieldSchema,
  nowMice: nowMiceSchema,
  groundkStory: groundkStorySchema,
  footer: footerSchema,
});

export type NewsletterContentParsed = z.infer<typeof newsletterContentSchema>;
