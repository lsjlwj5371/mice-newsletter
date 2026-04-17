import { z } from "zod";

export const ARTICLE_CATEGORIES = [
  "news",
  "mice_in_out",
  "tech",
  "theory",
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  news: "News Briefing",
  mice_in_out: "MICE IN & OUT",
  tech: "TECH SIGNAL",
  theory: "이론에서 현장으로",
};

export const CATEGORY_DESCRIPTIONS: Record<ArticleCategory, string> = {
  news: "MICE 산업 관련 일반 뉴스 (행사, 정책, 업계 소식)",
  mice_in_out: "행사·연사·기업 동향 (weekly briefing 피드 활용 가능)",
  tech: "이벤트테크·디지털·에듀테크 등 기술 트렌드",
  theory: "학술·전문지·심층 분석 콘텐츠",
};

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
  category: z.enum(ARTICLE_CATEGORIES),
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
  category: ArticleCategory;
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
  category: ArticleCategory;
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
