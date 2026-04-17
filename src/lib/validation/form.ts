import { z } from "zod";

export const FORM_KINDS = ["event", "feedback", "survey", "other"] as const;
export type FormKind = (typeof FORM_KINDS)[number];

export const FORM_KIND_LABELS: Record<FormKind, string> = {
  event: "이벤트 신청",
  feedback: "의견 수집",
  survey: "설문",
  other: "기타",
};

export const FIELD_TYPES = ["text", "textarea", "email", "choice"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "짧은 답변",
  textarea: "긴 답변",
  email: "이메일",
  choice: "선택지",
};

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  /** Only applies to type='choice'. */
  choices?: string[];
}

export const formFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  choices: z.array(z.string()).optional(),
});

export const formSchema = z.object({
  title: z.string().min(1, "제목은 필수입니다"),
  description: z.string().optional().nullable(),
  kind: z.enum(FORM_KINDS),
  fields: z.array(formFieldSchema).min(1, "필드를 최소 1개 추가하세요"),
  newsletterId: z.string().uuid().optional().nullable(),
  successMessage: z.string().optional().nullable(),
});

export type FormInput = z.input<typeof formSchema>;

export interface FormRow {
  id: string;
  title: string;
  description: string | null;
  kind: FormKind;
  fields: FormField[];
  newsletter_id: string | null;
  is_open: boolean;
  success_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface FormResponseRow {
  id: string;
  form_id: string;
  answers: Record<string, string | string[]>;
  recipient_id: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  submitted_at: string;
}
