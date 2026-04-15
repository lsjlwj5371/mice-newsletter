import { z } from "zod";

export const RECIPIENT_STATUSES = [
  "active",
  "unsubscribed",
  "pending",
  "bounced",
] as const;

export const RECIPIENT_SOURCES = ["initial", "referral", "manual"] as const;

export const STATUS_LABELS: Record<(typeof RECIPIENT_STATUSES)[number], string> =
  {
    active: "활성",
    unsubscribed: "수신 거부",
    pending: "대기",
    bounced: "반송",
  };

export const SOURCE_LABELS: Record<(typeof RECIPIENT_SOURCES)[number], string> =
  {
    initial: "초기",
    referral: "추천",
    manual: "직접 등록",
  };

const tagsField = z
  .string()
  .optional()
  .transform((val) =>
    (val ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  );

export const recipientSchema = z.object({
  email: z
    .string()
    .min(1, "이메일은 필수입니다")
    .email("이메일 형식이 올바르지 않습니다")
    .transform((v) => v.trim().toLowerCase()),
  name: z
    .string()
    .optional()
    .transform((v) => v?.trim() || null),
  organization: z
    .string()
    .optional()
    .transform((v) => v?.trim() || null),
  position: z
    .string()
    .optional()
    .transform((v) => v?.trim() || null),
  job_function: z
    .string()
    .optional()
    .transform((v) => v?.trim() || null),
  status: z.enum(RECIPIENT_STATUSES).default("active"),
  source: z.enum(RECIPIENT_SOURCES).default("manual"),
  tags: tagsField,
  notes: z
    .string()
    .optional()
    .transform((v) => v?.trim() || null),
});

export type RecipientInput = z.input<typeof recipientSchema>;
export type RecipientParsed = z.output<typeof recipientSchema>;

// Type representing a recipient row as fetched from Supabase
export interface Recipient {
  id: string;
  email: string;
  name: string | null;
  organization: string | null;
  position: string | null;
  job_function: string | null;
  status: (typeof RECIPIENT_STATUSES)[number];
  source: (typeof RECIPIENT_SOURCES)[number];
  tags: string[];
  notes: string | null;
  created_at: string;
  unsubscribed_at: string | null;
  referred_by: string | null;
}
