/**
 * Higher-level newsletter section components.
 * All inline-styled for email client compatibility.
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
  InsightBox,
  MajorSection,
  Pill,
} from "./primitives";
import type {
  HeaderContent,
  ReferralCtaContent,
  OpeningHookContent,
  NumberOfMonthContent,
  BriefingSection,
  MiceInOutContent,
  MiceInOutCard,
  TechSignalContent,
  TheoryToFieldContent,
  NowMiceContent,
  GroundkStoryContent,
  FooterContent,
} from "@/types/newsletter";

// ─────────────────────────────────────────────
// 1. Header — SPEAK wordmark
// ─────────────────────────────────────────────
export function SpeakHeader({ content }: { content: HeaderContent }) {
  return (
    <Section
      style={{
        paddingBottom: spacing.headerBottomBorderGap,
        marginBottom: spacing.headerBottomBorderGap,
        borderBottom: `2px solid ${colors.borderStrong}`,
      }}
    >
      {/* Top message */}
      <Text
        style={{
          fontSize: "13px",
          fontWeight: 400,
          color: colors.textMuted,
          margin: "0 0 16px 0",
          letterSpacing: "-0.2px",
        }}
      >
        {content.topMessage}
      </Text>

      {/* Wordmark */}
      <Heading
        as="h1"
        style={{
          fontSize: "72px",
          fontWeight: 900,
          lineHeight: 0.95,
          color: colors.brandNavy,
          letterSpacing: "-2px",
          margin: "0 0 12px 0",
          fontFamily:
            "'Pretendard', 'Impact', 'Arial Black', Arial, sans-serif",
        }}
      >
        {content.wordmark}
      </Heading>

      {/* Subtitle with bolded acronym letters */}
      <Text
        style={{
          fontSize: "14px",
          fontWeight: 400,
          color: colors.textMuted,
          margin: 0,
          letterSpacing: "-0.1px",
          lineHeight: 1.5,
        }}
      >
        {renderSubtitleWithBoldChars(content.subtitle, content.boldIndices)}
      </Text>
    </Section>
  );
}

function renderSubtitleWithBoldChars(
  subtitle: string,
  boldIndices: number[]
): React.ReactNode[] {
  const set = new Set(boldIndices);
  return Array.from(subtitle).map((char, i) =>
    set.has(i) ? (
      <strong
        key={i}
        style={{
          color: colors.brandNavy,
          fontWeight: 800,
        }}
      >
        {char}
      </strong>
    ) : (
      <React.Fragment key={i}>{char}</React.Fragment>
    )
  );
}

// ─────────────────────────────────────────────
// 2. Referral CTA (compact horizontal)
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
              fontSize: "13px",
              lineHeight: 1.7,
              color: colors.textBody,
              fontWeight: 400,
              margin: 0,
            }}
          >
            {content.message}
          </Text>
        </Column>
        <Column
          align="right"
          style={{ verticalAlign: "middle", width: "140px" }}
        >
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
              whiteSpace: "nowrap",
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
// 3. Opening hook
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
              <span
                style={{
                  ...typography.bigNumberSuffix,
                  color: colors.accentGold,
                }}
              >
                {content.suffix}
              </span>
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
// 5. News Briefing — multi-item list
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
// 6. MICE IN & OUT — 2-column cards
// ─────────────────────────────────────────────
export function MiceInOutTwoColumn({
  content,
  index = "03",
}: {
  content: MiceInOutContent;
  index?: string;
}) {
  return (
    <MajorSection>
      <SectionLabel index={index} label={content.englishLabel} />
      <Row>
        <Column
          style={{
            verticalAlign: "top",
            paddingRight: "8px",
            width: "50%",
          }}
        >
          <InOutCard card={content.inItem} accent={colors.brandNavy} />
        </Column>
        <Column
          style={{
            verticalAlign: "top",
            paddingLeft: "8px",
            width: "50%",
          }}
        >
          <InOutCard card={content.outItem} accent={colors.accentGold} />
        </Column>
      </Row>
    </MajorSection>
  );
}

function InOutCard({
  card,
  accent,
}: {
  card: MiceInOutCard;
  accent: string;
}) {
  return (
    <Section
      style={{
        backgroundColor: colors.bgWhite,
        border: `1px solid ${colors.borderCard}`,
        borderRadius: "14px",
        overflow: "hidden",
      }}
    >
      {/* Top accent stripe */}
      <Section
        style={{
          backgroundColor: accent,
          height: "3px",
          fontSize: "0",
          lineHeight: "0",
        }}
      >
        &nbsp;
      </Section>
      <Section style={{ padding: "18px" }}>
        <Text
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: accent,
            margin: "0 0 10px 0",
          }}
        >
          ● {card.categoryTag}
        </Text>
        <Heading
          as="h3"
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: colors.textHeadline,
            lineHeight: 1.45,
            margin: "0 0 10px 0",
            letterSpacing: "-0.3px",
          }}
        >
          {card.title}
        </Heading>
        <Text
          style={{
            fontSize: "13px",
            color: colors.textMuted,
            lineHeight: 1.75,
            margin: "0 0 12px 0",
            fontWeight: 300,
          }}
        >
          {card.body}
        </Text>
        {card.source && (
          <Text
            style={{
              fontSize: "10px",
              color: colors.textFaint,
              letterSpacing: "0.3px",
              margin: 0,
            }}
          >
            {card.source}
          </Text>
        )}
      </Section>
    </Section>
  );
}

// ─────────────────────────────────────────────
// 7. TECH SIGNAL — dark inverted section
// ─────────────────────────────────────────────
export function TechSignalDarkSection({
  content,
  index = "04",
}: {
  content: TechSignalContent;
  index?: string;
}) {
  return (
    <Section
      style={{
        backgroundColor: colors.bgTechDark,
        padding: "40px 28px",
        borderRadius: "14px",
        margin: `${spacing.sectionVertical} 0`,
      }}
    >
      {/* Section label on dark */}
      <Section style={{ marginBottom: "20px" }}>
        <Text
          style={{
            ...typography.sectionLabel,
            color: colors.accentGold,
            margin: 0,
          }}
        >
          <span style={{ color: colors.accentGold }}>{index}</span>
          <span
            style={{ color: colors.textOnDarkFaint, margin: "0 6px" }}
          >
            /
          </span>
          <span style={{ color: colors.textOnDarkMuted }}>
            {content.englishLabel.toUpperCase()}
          </span>
        </Text>
      </Section>

      {/* Inner card */}
      <Section
        style={{
          backgroundColor: colors.bgTechDarker,
          border: `1px solid ${colors.borderTechAccent}`,
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        {/* Topic top bar */}
        <Section
          style={{
            backgroundColor: "rgba(232,160,32,0.08)",
            borderBottom: `1px solid ${colors.borderTechAccent}`,
            padding: "10px 20px",
          }}
        >
          <Row>
            <Column style={{ verticalAlign: "middle" }}>
              <Text
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "2px",
                  color: colors.accentGold,
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                ● {content.topicLabel}
              </Text>
            </Column>
            {content.topicMeta && (
              <Column align="right" style={{ verticalAlign: "middle" }}>
                <Text
                  style={{
                    fontSize: "10px",
                    color: colors.textOnDarkFaint,
                    letterSpacing: "0.5px",
                    margin: 0,
                  }}
                >
                  {content.topicMeta}
                </Text>
              </Column>
            )}
          </Row>
        </Section>

        {/* Body */}
        <Section style={{ padding: "24px" }}>
          <Heading
            as="h2"
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: colors.textOnDark,
              lineHeight: 1.4,
              letterSpacing: "-0.2px",
              margin: "0 0 16px 0",
            }}
          >
            {content.title}
          </Heading>

          {content.paragraphs.map((p, i) => (
            <Text
              key={i}
              style={{
                fontSize: "13px",
                color: colors.textOnDarkBody,
                lineHeight: 1.85,
                fontWeight: 300,
                margin: "0 0 16px 0",
              }}
              dangerouslySetInnerHTML={{
                __html: renderInlineMarkdownOnDark(p),
              }}
            />
          ))}

          {/* MICE perspective insight */}
          <Section
            style={{
              backgroundColor: colors.insightOnDark,
              border: `1px solid ${colors.insightOnDarkBorder}`,
              borderRadius: "8px",
              padding: "14px 16px",
              marginTop: "8px",
            }}
          >
            <Text
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "2px",
                color: "#8b9ee8",
                textTransform: "uppercase",
                margin: "0 0 6px 0",
              }}
            >
              MICE 관점
            </Text>
            <Text
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.75,
                fontWeight: 300,
                margin: 0,
              }}
              dangerouslySetInnerHTML={{
                __html: renderInlineMarkdownOnDark(content.miceInsight),
              }}
            />
          </Section>
        </Section>
      </Section>
    </Section>
  );
}

// ─────────────────────────────────────────────
// 8. From Theory to Field — long-form story
// ─────────────────────────────────────────────
export function TheoryToFieldSection({
  content,
  index = "05",
}: {
  content: TheoryToFieldContent;
  index?: string;
}) {
  return (
    <MajorSection>
      <SectionLabel index={index} label={content.englishLabel} />

      {/* Source row */}
      {(content.sourceYear || content.sourceAuthor) && (
        <Section style={{ marginBottom: "18px" }}>
          <Row>
            {content.sourceYear && (
              <Column style={{ width: "70px", verticalAlign: "middle" }}>
                <Text
                  style={{
                    fontSize: "32px",
                    color: colors.accentGold,
                    opacity: 0.6,
                    lineHeight: 1,
                    margin: 0,
                    fontWeight: 700,
                  }}
                >
                  {content.sourceYear}
                </Text>
              </Column>
            )}
            <Column
              style={{
                verticalAlign: "middle",
                paddingLeft: "12px",
                borderLeft: `1px solid ${colors.borderSoft}`,
              }}
            >
              {content.sourceAuthor && (
                <Text
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: colors.textMuted,
                    letterSpacing: "0.5px",
                    margin: "0 0 2px 0",
                  }}
                >
                  {content.sourceAuthor}
                </Text>
              )}
              {content.sourceMeta && (
                <Text
                  style={{
                    fontSize: "10px",
                    color: colors.textFaint,
                    fontStyle: "italic",
                    margin: 0,
                  }}
                >
                  {content.sourceMeta}
                </Text>
              )}
            </Column>
          </Row>
        </Section>
      )}

      {/* Title */}
      <Heading
        as="h2"
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: colors.textHeadline,
          lineHeight: 1.35,
          letterSpacing: "-0.3px",
          paddingBottom: "16px",
          borderBottom: `2px solid ${colors.accentGold}`,
          margin: "0 0 22px 0",
          display: "inline-block",
        }}
      >
        {content.title}
      </Heading>

      {/* Intro paragraphs */}
      {content.introParagraphs.map((p, i) => (
        <Text
          key={`intro-${i}`}
          style={{
            fontSize: "14px",
            color: colors.textBody,
            lineHeight: 1.95,
            fontWeight: 300,
            margin: "0 0 16px 0",
          }}
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(p) }}
        />
      ))}

      {/* Bridge box (→ 현장에서는) */}
      <Section
        style={{
          margin: "24px 0",
          borderLeft: `3px solid ${colors.accentGold}`,
          backgroundColor: colors.bgInsightSoft,
          padding: "18px 20px",
        }}
      >
        <Text
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "2px",
            color: colors.accentGold,
            textTransform: "uppercase",
            margin: "0 0 8px 0",
          }}
        >
          {content.bridge.label ?? "→ 현장에서는"}
        </Text>
        <Text
          style={{
            fontSize: "14px",
            color: colors.textBody,
            lineHeight: 1.85,
            fontWeight: 300,
            margin: 0,
          }}
          dangerouslySetInnerHTML={{
            __html: renderInlineMarkdown(content.bridge.text),
          }}
        />
      </Section>

      {/* Outro paragraphs */}
      {content.outroParagraphs.map((p, i) => (
        <Text
          key={`outro-${i}`}
          style={{
            fontSize: "14px",
            color: colors.textBody,
            lineHeight: 1.95,
            fontWeight: 300,
            margin: "0 0 16px 0",
          }}
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(p) }}
        />
      ))}

      {/* Closing italic note */}
      {content.closingNote && (
        <Text
          style={{
            fontSize: "13px",
            fontStyle: "italic",
            color: colors.textSoft,
            lineHeight: 1.7,
            paddingTop: "18px",
            borderTop: `1px solid ${colors.borderSoft}`,
            margin: 0,
          }}
        >
          {content.closingNote}
        </Text>
      )}
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// 9. 지금 MICE는 (light section now, with pull quote card)
// ─────────────────────────────────────────────
export function NowMiceSection({
  content,
  index = "06",
}: {
  content: NowMiceContent;
  index?: string;
}) {
  return (
    <MajorSection>
      <SectionLabel index={index} label={content.englishLabel} />

      {content.eyebrow && (
        <Text
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "2px",
            color: colors.accentGold,
            textTransform: "uppercase",
            margin: "0 0 8px 0",
          }}
        >
          {content.eyebrow}
        </Text>
      )}

      <Heading
        as="h2"
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: colors.textHeadline,
          lineHeight: 1.3,
          letterSpacing: "-0.3px",
          paddingBottom: "18px",
          borderBottom: `2px solid ${colors.accentGold}`,
          margin: "0 0 24px 0",
        }}
      >
        {renderMultiline(content.title)}
      </Heading>

      {content.leadParagraph && (
        <Text
          style={{
            fontSize: "14px",
            color: colors.textBody,
            lineHeight: 1.95,
            fontWeight: 300,
            margin: "0 0 8px 0",
          }}
        >
          {content.leadParagraph}
        </Text>
      )}

      {content.pullQuote && (
        <Section
          style={{
            margin: "26px 0",
            borderLeft: `3px solid ${colors.brandNavy}`,
            backgroundColor: "#e8eaf6",
            padding: "18px 20px",
          }}
        >
          <Text
            style={{
              fontSize: "17px",
              fontWeight: 700,
              fontStyle: "italic",
              color: colors.brandNavy,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            &ldquo;{renderMultiline(content.pullQuote)}&rdquo;
          </Text>
        </Section>
      )}

      {content.paragraphs.map((p, i) => (
        <Text
          key={i}
          style={{
            fontSize: "14px",
            color: colors.textBody,
            lineHeight: 1.95,
            fontWeight: 300,
            margin: "0 0 16px 0",
          }}
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(p) }}
        />
      ))}

      {content.closingNote && (
        <Text
          style={{
            fontSize: "13px",
            fontStyle: "italic",
            color: colors.textSoft,
            lineHeight: 1.7,
            paddingTop: "18px",
            borderTop: `1px solid ${colors.borderSoft}`,
            margin: 0,
          }}
        >
          {content.closingNote}
        </Text>
      )}
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// 10. GroundK Story — Field Briefing (dark) + Project Sketch (light)
// ─────────────────────────────────────────────
export function GroundkStoryMajorSection({
  content,
  index = "07",
}: {
  content: GroundkStoryContent;
  index?: string;
}) {
  return (
    <MajorSection noBorder>
      <SectionLabel index={index} label={content.englishLabel} />

      {/* Field Briefing — dark card */}
      <Section
        style={{
          backgroundColor: "#1A1A2E",
          borderRadius: "14px",
          padding: "22px 24px",
          marginBottom: "16px",
        }}
      >
        <Text
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "2.5px",
            color: colors.accentGold,
            textTransform: "uppercase",
            margin: "0 0 14px 0",
          }}
        >
          {content.fieldBriefing.eyebrow}
        </Text>

        <Section
          style={{
            borderLeft: `3px solid rgba(232,160,32,0.5)`,
            paddingLeft: "14px",
          }}
        >
          <Text
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: colors.textOnDarkMuted,
              margin: "0 0 4px 0",
            }}
          >
            {content.fieldBriefing.categoryTag}
          </Text>
          <Text
            style={{
              fontSize: "13px",
              color: colors.textOnDarkBody,
              lineHeight: 1.85,
              fontWeight: 300,
              margin: 0,
              whiteSpace: "pre-line",
            }}
            dangerouslySetInnerHTML={{
              __html: renderInlineMarkdownOnDark(
                content.fieldBriefing.body.replace(/\n/g, "<br>")
              ),
            }}
          />
        </Section>
      </Section>

      {/* Project Sketch — light card */}
      <Section
        style={{
          backgroundColor: colors.bgWhite,
          border: `1px solid ${colors.borderCard}`,
          borderRadius: "14px",
          padding: "24px",
        }}
      >
        {/* Meta row */}
        <Row style={{ marginBottom: "14px" }}>
          <Column>
            <Text
              style={{
                fontSize: "10px",
                letterSpacing: "2px",
                color: colors.textMuted,
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              {content.projectSketch.projectMeta}
            </Text>
          </Column>
          <Column align="right">
            <Text
              style={{
                fontSize: "10px",
                letterSpacing: "1px",
                color: colors.accentGold,
                margin: 0,
              }}
            >
              {content.projectSketch.dateMeta}
            </Text>
          </Column>
        </Row>

        {/* Eyebrow */}
        <Text
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "2px",
            color: colors.brandNavy,
            textTransform: "uppercase",
            opacity: 0.65,
            margin: "0 0 6px 0",
          }}
        >
          {content.projectSketch.eyebrow}
        </Text>

        {/* Title */}
        <Heading
          as="h3"
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: colors.textHeadline,
            lineHeight: 1.35,
            letterSpacing: "-0.3px",
            paddingBottom: "16px",
            borderBottom: `2px solid ${colors.accentGold}`,
            margin: "0 0 18px 0",
          }}
        >
          {content.projectSketch.title}
        </Heading>

        {/* Paragraphs */}
        {content.projectSketch.paragraphs.map((p, i) => (
          <Text
            key={i}
            style={{
              fontSize: "13px",
              color: colors.textMuted,
              lineHeight: 1.85,
              margin: "0 0 14px 0",
            }}
          >
            {p}
          </Text>
        ))}

        {/* Tags */}
        {content.projectSketch.tags.length > 0 && (
          <Section
            style={{
              paddingTop: "14px",
              borderTop: `1px solid ${colors.borderSoft}`,
              marginTop: "6px",
            }}
          >
            {content.projectSketch.tags.map((t, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  backgroundColor: "#e8eaf6",
                  color: colors.brandNavy,
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "4px",
                  letterSpacing: "0.5px",
                  marginRight: "6px",
                }}
              >
                {t}
              </span>
            ))}
          </Section>
        )}
      </Section>
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// 11. Footer
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
        <Column
          width="40%"
          align="right"
          style={{ verticalAlign: "bottom" }}
        >
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInlineMarkdown(s: string): string {
  const escaped = escapeHtml(s);
  return escaped
    .replace(
      /\*\*([^*]+)\*\*/g,
      `<strong style="color:#1A1A2E;font-weight:600;">$1</strong>`
    )
    .replace(/<br>/g, "<br/>");
}

function renderInlineMarkdownOnDark(s: string): string {
  const escaped = escapeHtml(s);
  return escaped
    .replace(
      /\*\*([^*]+)\*\*/g,
      `<strong style="color:rgba(255,255,255,0.85);font-weight:500;">$1</strong>`
    )
    .replace(/<br>/g, "<br/>");
}

// Re-exports kept for any consumer
export { Pill, InsightBox, SectionLabelOnDark };
