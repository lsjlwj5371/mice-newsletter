/**
 * Higher-level section components composed from primitives.
 */

import * as React from "react";
import {
  Section,
  Row,
  Column,
  Text,
  Heading,
  Img,
  Link,
} from "@react-email/components";
import { colors, typography, spacing } from "../tokens";
import {
  SectionLabel,
  SectionLabelOnDark,
  ItemGroup,
  MajorSection,
  Pill,
} from "./primitives";
import type {
  HeaderContent,
  ReferralCtaContent,
  OpeningHookContent,
  NumberOfMonthContent,
  BriefingSection,
  NowMiceContent,
  GroundkStorySection,
  FooterContent,
} from "@/types/newsletter";

// ─────────────────────────────────────────────
// 1. Header
// ─────────────────────────────────────────────
export function NewsletterHeader({ content }: { content: HeaderContent }) {
  return (
    <Section
      style={{
        paddingBottom: spacing.headerBottomBorderGap,
        marginBottom: spacing.headerBottomBorderGap,
        borderBottom: `2px solid ${colors.borderStrong}`,
      }}
    >
      <Text
        style={{
          ...typography.eyebrow,
          color: colors.textMuted,
          margin: "0 0 12px 0",
        }}
      >
        {content.eyebrow}
      </Text>
      <Heading
        as="h1"
        style={{
          ...typography.brandTitle,
          color: colors.brandNavy,
          margin: "0 0 16px 0",
        }}
      >
        {content.brandTitle}
      </Heading>
      <Text
        style={{
          ...typography.tagline,
          color: "#555555",
          margin: 0,
        }}
      >
        {content.tagline}
      </Text>
    </Section>
  );
}

// ─────────────────────────────────────────────
// 2. Referral CTA (compact — short text + button)
// ─────────────────────────────────────────────
export function ReferralCtaTop({ content }: { content: ReferralCtaContent }) {
  return (
    <Section
      style={{
        backgroundColor: colors.bgInsight,
        padding: "20px 24px",
        borderRadius: "8px",
        marginBottom: "8px",
      }}
    >
      <Row>
        <Column style={{ verticalAlign: "middle" }}>
          <Text
            style={{
              fontSize: "14px",
              lineHeight: 1.6,
              color: colors.textBody,
              fontWeight: 400,
              margin: 0,
            }}
          >
            {content.message}
          </Text>
        </Column>
        <Column align="right" style={{ verticalAlign: "middle", width: "140px" }}>
          <Link
            href={content.buttonHref}
            style={{
              display: "inline-block",
              backgroundColor: colors.brandNavy,
              color: colors.textOnDark,
              textDecoration: "none",
              ...typography.ctaButton,
              padding: "10px 18px",
              borderRadius: "4px",
            }}
          >
            {content.buttonLabel} →
          </Link>
        </Column>
      </Row>
    </Section>
  );
}

// ─────────────────────────────────────────────
// 3. Opening hook (gold left border + large quote)
// ─────────────────────────────────────────────
export function OpeningHook({ content }: { content: OpeningHookContent }) {
  return (
    <MajorSection
      noBorder
      style={{ paddingTop: "8px", paddingBottom: "20px" }}
    >
      <Section
        style={{
          borderLeft: `4px solid ${colors.accentGold}`,
          paddingLeft: "20px",
        }}
      >
        <Text
          style={{
            ...typography.hookText,
            color: colors.textHeadline,
            margin: 0,
            wordBreak: "keep-all",
          }}
        >
          {renderMultiline(content.hook)}
        </Text>
        {content.subtext && (
          <Text
            style={{
              ...typography.hookSubtext,
              color: colors.textMuted,
              marginTop: "16px",
              marginBottom: 0,
            }}
          >
            {renderMultiline(content.subtext)}
          </Text>
        )}
      </Section>
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// 4. Number of the Month
// ─────────────────────────────────────────────
export function NumberOfMonthSection({
  content,
  index = "01",
}: {
  content: NumberOfMonthContent;
  index?: string;
}) {
  return (
    <MajorSection>
      <SectionLabel index={index} label="Number of the Month" />
      <Section>
        <Text style={{ margin: "0 0 16px 0" }}>
          <span
            style={{
              ...typography.bigNumber,
              color: colors.textHeadline,
              display: "inline-block",
            }}
          >
            {content.number}
            {content.suffix && (
              <span style={typography.bigNumberSuffix}>{content.suffix}</span>
            )}
          </span>
        </Text>
        <Text
          style={{
            ...typography.numberCaption,
            color: colors.textHeadline,
            margin: "0 0 8px 0",
          }}
          dangerouslySetInnerHTML={{
            __html: renderInlineMarkdown(content.caption),
          }}
        />
        <Text
          style={{
            ...typography.numberSource,
            color: colors.textSoft,
            margin: 0,
          }}
        >
          {content.source}
        </Text>
      </Section>
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// 5/6/7/8. Briefing-style sections (News Briefing, MICE IN&OUT, Tech, Theory)
// ─────────────────────────────────────────────
export function BriefingMajorSection({
  content,
  index,
}: {
  content: BriefingSection;
  index: string;
}) {
  return (
    <MajorSection>
      <SectionLabel index={index} label={content.englishLabel} />
      {content.items.map((item, i) => (
        <ItemGroup
          key={i}
          categoryTag={item.categoryTag}
          title={item.title}
          body={item.body}
          insight={item.insight}
          sourceUrl={item.sourceUrl}
          isLast={i === content.items.length - 1}
        />
      ))}
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// 9. 지금 MICE는 — dark navy card with pull quote
// ─────────────────────────────────────────────
export function NowMiceSection({
  content,
  index = "06",
}: {
  content: NowMiceContent;
  index?: string;
}) {
  return (
    <Section
      style={{
        backgroundColor: colors.bgDarkCard,
        padding: spacing.darkCardPadding,
        borderRadius: spacing.darkCardRadius,
        margin: "20px 0",
      }}
    >
      <SectionLabelOnDark index={index} label={content.englishLabel} />
      <Heading
        as="h2"
        style={{
          ...typography.itemTitle,
          fontSize: "24px",
          color: colors.textOnDark,
          margin: "0 0 24px 0",
        }}
      >
        {content.title}
      </Heading>

      {content.pullQuote && (
        <Section
          style={{
            paddingLeft: "20px",
            borderLeft: `3px solid ${colors.accentGold}`,
            margin: "32px 0",
          }}
        >
          <Text
            style={{
              fontSize: "20px",
              fontWeight: 300,
              color: colors.textOnDark,
              lineHeight: 1.5,
              fontStyle: "italic",
              margin: 0,
            }}
          >
            &ldquo;{content.pullQuote}&rdquo;
          </Text>
        </Section>
      )}

      {content.paragraphs.map((p, i) => (
        <Text
          key={i}
          style={{
            ...typography.bodyText,
            color: colors.textOnDarkBody,
            margin: i === 0 ? "0 0 16px 0" : "0 0 16px 0",
          }}
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(p) }}
        />
      ))}
    </Section>
  );
}

// ─────────────────────────────────────────────
// 10. GroundK Story
// ─────────────────────────────────────────────
export function GroundkStoryMajorSection({
  content,
  index = "07",
}: {
  content: GroundkStorySection;
  index?: string;
}) {
  return (
    <MajorSection noBorder>
      <SectionLabel index={index} label={content.englishLabel} />
      {content.items.map((item, i) => (
        <Section
          key={i}
          style={{
            marginBottom:
              i === content.items.length - 1 ? "0" : spacing.itemGroupGap,
          }}
        >
          <Text
            style={{
              ...typography.categoryTag,
              color: colors.brandNavy,
              margin: "0 0 6px 0",
            }}
          >
            {item.categoryTag}
          </Text>
          <Heading
            as="h2"
            style={{
              ...typography.itemTitle,
              color: colors.textHeadline,
              margin: "0 0 12px 0",
            }}
          >
            {item.title}
          </Heading>
          <Text
            style={{
              ...typography.bodyText,
              color: colors.textBody,
              margin: 0,
            }}
          >
            {item.body}
          </Text>
          {item.pills && item.pills.length > 0 && (
            <Section style={{ marginTop: "16px" }}>
              {item.pills.map((p, j) => (
                <Pill key={j} label={p} />
              ))}
            </Section>
          )}
        </Section>
      ))}
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// 11. Footer (logo top-left + links / unsubscribe right)
// ─────────────────────────────────────────────
export function NewsletterFooter({
  content,
  appUrl,
}: {
  content: FooterContent;
  appUrl: string;
}) {
  const logoSrc = content.logoSrc ?? `${appUrl}/logo.png`;

  return (
    <Section
      style={{
        marginTop: "60px",
        paddingTop: "40px",
        paddingBottom: "40px",
        borderTop: `2px solid ${colors.borderStrong}`,
      }}
    >
      <Row>
        <Column width="60%" style={{ verticalAlign: "top" }}>
          <Img
            src={logoSrc}
            alt={content.brandName}
            width="160"
            style={{
              display: "block",
              marginBottom: "16px",
              maxWidth: "160px",
              height: "auto",
            }}
          />
          <Text
            style={{
              ...typography.footerLink,
              color: colors.textMuted,
              margin: 0,
            }}
          >
            {content.links.map((link, i) => (
              <React.Fragment key={i}>
                <Link
                  href={link.href}
                  style={{
                    color: colors.textMuted,
                    textDecoration: "none",
                  }}
                >
                  {link.label}
                </Link>
                {i < content.links.length - 1 && <br />}
              </React.Fragment>
            ))}
          </Text>
        </Column>
        <Column width="40%" align="right" style={{ verticalAlign: "bottom" }}>
          <Text
            style={{
              ...typography.footerSmall,
              color: colors.textFaint,
              textAlign: "right",
              margin: 0,
            }}
          >
            수신을 원치 않으시면{" "}
            <Link
              href={content.unsubscribeHref}
              style={{
                color: colors.textHeadline,
                textDecoration: "underline",
              }}
            >
              여기
            </Link>
            에서 수신 거부하실 수 있습니다.
          </Text>
        </Column>
      </Row>
    </Section>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function renderMultiline(s: string): React.ReactNode {
  const parts = s.split("\n");
  return parts.map((line, i) => (
    <React.Fragment key={i}>
      {line}
      {i < parts.length - 1 && <br />}
    </React.Fragment>
  ));
}

/**
 * Tiny inline markdown: only **bold**.
 * Used for caption fields where Claude may emit emphasis.
 */
function renderInlineMarkdown(s: string): string {
  // Escape HTML first to prevent XSS-ish issues, then convert **bold**
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
