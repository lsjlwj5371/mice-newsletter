import { createAdminClient } from "@/lib/supabase/admin";
import type {
  HeaderContent,
  ReferralCtaContent,
  InquiryCtaContent,
  FooterContent,
} from "@/types/newsletter";

/**
 * Hardcoded fallbacks — used if the `template_settings` table row is
 * missing (fresh DB, failed migration, etc). Keeps issue generation
 * working even when settings load fails.
 */
const HEADER_FALLBACK: HeaderContent = {
  wordmark: "MICE人sight",
  tagline: "We pick what moves you",
  industryTag: "",
  issueMeta: "",
  description: "MICE 업계 종사자를 위한 인사이트 레터 · by GroundK",
};

const REFERRAL_FALLBACK: ReferralCtaContent = {
  message:
    "지금부터 드리는 정보가 유익하셨거나, 함께 받으면 좋을 분이 떠오르셨다면 알려주세요. 다음 호부터 그분께도 전달해드리겠습니다.",
  buttonLabel: "추천하기",
  buttonHref: "{{REFERRAL_HREF}}",
};

// inquiryCta — buttonHref 가 비어있는 동안 렌더러는 섹션 자체를 숨김.
// 어드민이 /events 에서 폼을 만든 뒤 그 /f/{token} URL 을 여기에 박으면
// 푸터 위에 "문의하기" 버튼이 자동으로 나타난다.
const INQUIRY_FALLBACK: InquiryCtaContent = {
  message:
    "뉴스레터에 대해 문의·피드백이 있으시다면 아래 버튼을 통해 알려주세요.",
  buttonLabel: "문의하기",
  buttonHref: "",
};

const FOOTER_FALLBACK: FooterContent = {
  brandName: "MICE人sight by GroundK",
  brandTagline: "We pick what moves you",
  links: [
    { label: "groundk.co.kr", href: "https://groundk.co.kr" },
    { label: "triseup.com", href: "https://triseup.com" },
    { label: "rideus.co.kr", href: "https://rideus.co.kr" },
  ],
  unsubscribeHref: "{{UNSUBSCRIBE_HREF}}",
  miceLogoHref: "https://linktr.ee/mice_in",
  groundkLogoHref: "",
};

export interface TemplateSettings {
  header: HeaderContent;
  referralCta: ReferralCtaContent;
  inquiryCta: InquiryCtaContent;
  footer: FooterContent;
}

/**
 * Load the singleton template settings row from `template_settings`
 * (id='default'). Returns fallbacks when the row is missing or any
 * part fails to parse as the expected shape — generation never blocks
 * on a misconfigured template.
 */
export async function loadTemplateSettings(): Promise<TemplateSettings> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("template_settings")
      .select("header, referral_cta, inquiry_cta, footer")
      .eq("id", "default")
      .maybeSingle();
    if (error || !data) {
      return {
        header: HEADER_FALLBACK,
        referralCta: REFERRAL_FALLBACK,
        inquiryCta: INQUIRY_FALLBACK,
        footer: FOOTER_FALLBACK,
      };
    }
    return {
      header: {
        ...HEADER_FALLBACK,
        ...(data.header as Partial<HeaderContent>),
      },
      referralCta: {
        ...REFERRAL_FALLBACK,
        ...(data.referral_cta as Partial<ReferralCtaContent>),
      },
      inquiryCta: {
        ...INQUIRY_FALLBACK,
        ...((data.inquiry_cta as Partial<InquiryCtaContent> | null) ?? {}),
      },
      footer: {
        ...FOOTER_FALLBACK,
        ...(data.footer as Partial<FooterContent>),
      },
    };
  } catch {
    return {
      header: HEADER_FALLBACK,
      referralCta: REFERRAL_FALLBACK,
      inquiryCta: INQUIRY_FALLBACK,
      footer: FOOTER_FALLBACK,
    };
  }
}

export const TEMPLATE_FALLBACKS = {
  header: HEADER_FALLBACK,
  referralCta: REFERRAL_FALLBACK,
  inquiryCta: INQUIRY_FALLBACK,
  footer: FOOTER_FALLBACK,
};
