import { createAdminClient } from "@/lib/supabase/admin";
import type {
  HeaderContent,
  ReferralCtaContent,
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
      .select("header, referral_cta, footer")
      .eq("id", "default")
      .maybeSingle();
    if (error || !data) {
      return {
        header: HEADER_FALLBACK,
        referralCta: REFERRAL_FALLBACK,
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
      footer: {
        ...FOOTER_FALLBACK,
        ...(data.footer as Partial<FooterContent>),
      },
    };
  } catch {
    return {
      header: HEADER_FALLBACK,
      referralCta: REFERRAL_FALLBACK,
      footer: FOOTER_FALLBACK,
    };
  }
}

export const TEMPLATE_FALLBACKS = {
  header: HEADER_FALLBACK,
  referralCta: REFERRAL_FALLBACK,
  footer: FOOTER_FALLBACK,
};
