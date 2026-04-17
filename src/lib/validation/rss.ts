import { z } from "zod";
import {
  BLOCK_TYPES,
  BLOCK_LABELS,
  BLOCK_DESCRIPTIONS,
  type BlockType,
} from "@/types/newsletter";

/**
 * Article categories are now derived from block slugs (excluding
 * opening_lede which is pure narrative). Adding a new block type to
 * BLOCK_TYPES automatically makes it available as a category option
 * in the RSS feed form — no schema migration required because the
 * underlying columns are text[].
 */
export type ArticleCategory = Exclude<BlockType, "opening_lede">;

export const ARTICLE_CATEGORIES = BLOCK_TYPES.filter(
  (t) => t !== "opening_lede"
) as readonly ArticleCategory[];

export const CATEGORY_LABELS: Record<ArticleCategory, string> =
  Object.fromEntries(
    ARTICLE_CATEGORIES.map((c) => [c, BLOCK_LABELS[c]])
  ) as Record<ArticleCategory, string>;

export const CATEGORY_DESCRIPTIONS: Record<ArticleCategory, string> =
  Object.fromEntries(
    ARTICLE_CATEGORIES.map((c) => [c, BLOCK_DESCRIPTIONS[c]])
  ) as Record<ArticleCategory, string>;

export const rssFeedSchema = z.object({
  url: z
    .string()
    .min(1, "URL은 필수입니다")
    .url("올바른 URL 형식이 아닙니다")
    .transform((v) => v.trim()),
  name: z
    .string()
    .min(1, "이름은 필수입니다")
    .transform((v) => v.trim()),
  /**
   * Can be a comma-separated string from multi-select form submission, a
   * JSON-encoded array, or a real string[]. Normalizes to a validated
   * ArticleCategory[] with at least one entry.
   */
  categories: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => {
      if (Array.isArray(v)) return v;
      const trimmed = v.trim();
      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed as string[];
        } catch {
          // fall through to comma split
        }
      }
      return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    })
    .pipe(
      z
        .array(
          z.custom<ArticleCategory>(
            (v) => typeof v === "string" && (ARTICLE_CATEGORIES as readonly string[]).includes(v),
            { message: "알 수 없는 카테고리입니다" }
          )
        )
        .min(1, "카테고리를 최소 1개 선택하세요")
    ),
  active: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),
  notes: z
    .string()
    .optional()
    .transform((v) => v?.trim() || null),
});

export type RssFeedInput = z.input<typeof rssFeedSchema>;

export interface RssFeed {
  id: string;
  url: string;
  name: string;
  /** One or more categories this feed contributes to. */
  categories: ArticleCategory[];
  active: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
  notes: string | null;
  created_at: string;
}

export const ARTICLE_REVIEW_STATUSES = ["new", "archived"] as const;
export type ArticleReviewStatus = (typeof ARTICLE_REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ArticleReviewStatus, string> = {
  new: "검토 대기",
  archived: "불필요",
};

export interface Article {
  id: string;
  feed_id: string | null;
  guid: string;
  url: string;
  title: string;
  source: string | null;
  /** Categories inherited from the source feed at collection time. */
  categories: ArticleCategory[];
  published_at: string | null;
  collected_at: string;
  raw_excerpt: string | null;
  summary: string | null;
  tags: string[];
  importance: number | null;
  analyzed_at: string | null;
  analysis_error: string | null;
  used_in_newsletter_id: string | null;
  review_status: ArticleReviewStatus;
  pinned: boolean;
}
