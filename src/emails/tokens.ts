/**
 * Design tokens shared across all email components.
 * Mirrors the values from the sample HTML
 * (02. MICE 뉴스레터 샘플_미니멀.html).
 *
 * Email styling is inline because email clients strip <style>.
 * Use these tokens directly in style={{ ... }} props.
 */

export const colors = {
  brandNavy: "#2E3092",
  brandNavyDeep: "#1a1b6e",
  accentGold: "#E8A020",

  bgWhite: "#ffffff",
  bgInsight: "#f7f9fa",
  bgInsightSoft: "#f7f8ff",
  bgDarkCard: "#2E3092",

  // TECH SIGNAL — light tinted accent (minimal but distinct)
  bgTechAccent: "#f0f2fa",
  bgTechAccentSoft: "rgba(232,160,32,0.06)",
  borderTechAccent: "rgba(232,160,32,0.25)",

  // Field Briefing — light card differentiated from white project sketch
  bgFieldBriefing: "#f5f6fa",

  textHeadline: "#111111",
  textBody: "#444444",
  textMuted: "#666666",
  textSoft: "#888888",
  textFaint: "#999999",

  textOnDark: "#ffffff",
  textOnDarkBody: "rgba(255,255,255,0.62)",
  textOnDarkMuted: "rgba(255,255,255,0.35)",
  textOnDarkFaint: "rgba(255,255,255,0.18)",

  borderStrong: "#000000",
  borderSoft: "#eeeeee",
  borderPill: "#dddddd",
  borderCard: "rgba(46,48,146,0.09)",
} as const;

export const typography = {
  fontFamily:
    "'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",

  brandTitle: {
    fontSize: "40px",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-1px",
  },
  eyebrow: {
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
  },
  tagline: {
    fontSize: "15px",
    fontWeight: 300,
  },
  sectionLabel: {
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "1px",
    textTransform: "uppercase" as const,
  },
  itemTitle: {
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: 1.4,
    letterSpacing: "-0.5px",
  },
  bodyText: {
    fontSize: "15px",
    fontWeight: 300,
    lineHeight: 1.7,
    letterSpacing: "-0.2px",
  },
  categoryTag: {
    fontSize: "13px",
    fontWeight: 700,
  },
  insightLabel: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase" as const,
  },
  insightText: {
    fontSize: "14px",
    lineHeight: 1.6,
  },
  hookText: {
    fontSize: "20px",
    fontWeight: 700,
    lineHeight: 1.5,
    letterSpacing: "-0.5px",
  },
  hookSubtext: {
    fontSize: "14px",
    lineHeight: 1.6,
  },
  bigNumber: {
    fontSize: "80px",
    fontWeight: 300,
    lineHeight: 1,
    letterSpacing: "-4px",
  },
  bigNumberSuffix: {
    fontSize: "40px",
  },
  numberCaption: {
    fontSize: "18px",
    fontWeight: 400,
    lineHeight: 1.6,
  },
  numberSource: {
    fontSize: "13px",
  },
  ctaButton: {
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "0.5px",
  },
  footerHeading: {
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "1px",
  },
  footerLink: {
    fontSize: "13px",
    lineHeight: 1.8,
  },
  footerSmall: {
    fontSize: "12px",
    lineHeight: 1.6,
  },
} as const;

export const spacing = {
  containerMaxWidth: "640px",
  wrapperPadding: "40px 16px",
  sectionVertical: "50px",
  itemGroupGap: "40px",
  sectionHeaderGap: "32px",
  headerBottomBorderGap: "32px",
  insightBoxPadding: "20px",
  insightBoxRadius: "6px",
  ctaCardPadding: "24px",
  ctaCardRadius: "8px",
  darkCardPadding: "50px 40px",
  darkCardRadius: "12px",
} as const;
