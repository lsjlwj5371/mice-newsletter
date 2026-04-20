/**
 * Block components — one renderer per BlockType.
 * Each component receives a typed block instance and renders it inline-styled
 * for email client compatibility.
 *
 * The main Newsletter template iterates content.blocks and dispatches to the
 * right renderer here via BlockRenderer.
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
import { renderInlineHtml } from "../helpers";
import {
  SectionLabel,
  ItemGroup,
  MajorSection,
  Pill,
} from "./primitives";
import type {
  BlockInstance,
  HeaderContent,
  ReferralCtaContent,
  FooterContent,
  OpeningLedeBlock,
  StatFeatureBlock,
  NewsBriefingBlock,
  InOutComparisonBlock,
  MiceInOutCard,
  TechSignalBlock,
  TheoryToFieldBlock,
  EditorTakeBlock,
  GroundkStoryBlock,
  ConsolidatedInsightBlock,
  BlogCardGridBlock,
  ImageLayout,
} from "@/types/newsletter";

// ─────────────────────────────────────────────
// FIXED: Header — PIK wordmark
// ─────────────────────────────────────────────
export function NewsletterHeaderBlock({
  content,
}: {
  content: HeaderContent;
}) {
  return (
    <Section
      style={{
        paddingBottom: "32px",
        marginBottom: "32px",
        borderBottom: `2px solid ${colors.borderStrong}`,
      }}
    >
      {/* Industry tag eyebrow — only rendered when non-empty. Admins
          can clear it from the template settings if they don't want
          an industry label above the wordmark. */}
      {content.industryTag && content.industryTag.trim() !== "" && (
        <Text
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: colors.textMuted,
            margin: "0 0 16px 0",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          {content.industryTag}
        </Text>
      )}

      {/* Wordmark with inline diamond accent */}
      <Section style={{ marginBottom: "10px" }}>
        <Row>
          <Column style={{ verticalAlign: "middle", width: "auto" }}>
            <span
              style={{
                display: "inline-block",
                fontSize: "56px",
                fontWeight: 900,
                lineHeight: 0.95,
                color: colors.textHeadline,
                letterSpacing: "-1px",
                fontFamily:
                  "'Pretendard', 'Impact', 'Arial Black', Arial, sans-serif",
              }}
            >
              {renderWordmarkWithDiamond(content.wordmark)}
            </span>
            <span
              style={{
                display: "inline-block",
                marginLeft: "14px",
                fontSize: "13px",
                fontWeight: 400,
                color: colors.textMuted,
                verticalAlign: "middle",
                letterSpacing: "-0.1px",
              }}
            >
              {content.tagline}
            </span>
          </Column>
        </Row>
      </Section>

      {/* Description */}
      <Text
        style={{
          fontSize: "13px",
          color: colors.textSoft,
          fontWeight: 300,
          margin: "6px 0 18px 0",
        }}
      >
        {content.description}
      </Text>

      {/* Meta bar (issue number) */}
      <Section
        style={{
          paddingTop: "14px",
          borderTop: `1px solid ${colors.borderSoft}`,
        }}
      >
        <Text
          style={{
            fontSize: "9px",
            fontWeight: 700,
            color: colors.textFaint,
            letterSpacing: "2px",
            textTransform: "uppercase",
            margin: "0 0 3px 0",
          }}
        >
          Issue
        </Text>
        <Text
          style={{
            fontSize: "12px",
            color: colors.textMuted,
            margin: 0,
          }}
        >
          {content.issueMeta}
        </Text>
      </Section>
    </Section>
  );
}

/**
 * Render a wordmark like "PIK" with the middle letters styled as accent
 * (e.g. the "I" rendered in navy while P and K are black). Uses a simple
 * heuristic: if the wordmark contains recognized accent letters, color the
 * last one navy. Otherwise render plain.
 */
function renderWordmarkWithDiamond(wordmark: string): React.ReactNode {
  const chars = Array.from(wordmark);
  if (chars.length === 0) return wordmark;
  return chars.map((c, i) => (
    <span
      key={i}
      style={{
        color: i === chars.length - 1 ? colors.brandNavy : colors.textHeadline,
      }}
    >
      {c}
    </span>
  ));
}

// ─────────────────────────────────────────────
// FIXED: Referral CTA
// ─────────────────────────────────────────────
export function ReferralCtaBlock({
  content,
}: {
  content: ReferralCtaContent;
}) {
  return (
    <Section
      style={{
        backgroundColor: colors.bgInsight,
        padding: "22px 24px",
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
// FIXED: Footer
// ─────────────────────────────────────────────
export function NewsletterFooterBlock({
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
              marginBottom: "12px",
              maxWidth: "160px",
              height: "auto",
            }}
          />
          {content.brandTagline && (
            <Text
              style={{
                fontSize: "11px",
                color: colors.textFaint,
                margin: "0 0 10px 0",
                letterSpacing: "0.3px",
              }}
            >
              {content.brandTagline}
            </Text>
          )}
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
                  style={{ color: colors.textMuted, textDecoration: "none" }}
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
          {/* Intentionally empty — the unsubscribe line is now rendered
              on its own full-width row below so it fits on one line
              across typical email/web widths. */}
        </Column>
      </Row>
      <Row>
        <Column>
          <Text
            style={{
              ...typography.footerSmall,
              color: colors.textFaint,
              textAlign: "right",
              margin: "20px 0 0 0",
              whiteSpace: "nowrap",
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
// BLOCK: opening_lede
// ─────────────────────────────────────────────
function OpeningLede({ block }: { block: OpeningLedeBlock }) {
  return (
    <MajorSection
      noBorder
      style={{ paddingTop: "8px", paddingBottom: "20px" }}
    >
      <ImageWithBody
        src={block.data.imageUrl}
        layout={block.data.imageLayout}
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
            {renderMultiline(block.data.hook)}
          </Text>
          {block.data.subtext && (
            <Text
              style={{
                ...typography.hookSubtext,
                color: colors.textMuted,
                marginTop: "16px",
                marginBottom: 0,
              }}
            >
              {renderMultiline(block.data.subtext)}
            </Text>
          )}
        </Section>
      </ImageWithBody>
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// BLOCK: stat_feature (Number of the Month)
// ─────────────────────────────────────────────
function StatFeature({
  block,
  index,
}: {
  block: StatFeatureBlock;
  index: string;
}) {
  return (
    <MajorSection>
      <SectionLabel index={index} label={block.data.englishLabel} />
      <Section>
        <Text style={{ margin: "0 0 16px 0" }}>
          <span
            style={{
              ...typography.bigNumber,
              color: colors.textHeadline,
              display: "inline-block",
            }}
          >
            {block.data.number}
            {block.data.suffix && (
              <span
                style={{
                  ...typography.bigNumberSuffix,
                  color: colors.accentGold,
                }}
              >
                {block.data.suffix}
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
            __html: renderInlineHtml(block.data.caption),
          }}
        />
        <Text
          style={{
            ...typography.numberSource,
            color: colors.textSoft,
            margin: 0,
          }}
        >
          {block.data.source}
        </Text>
      </Section>
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// BLOCK: news_briefing
// ─────────────────────────────────────────────
function NewsBriefing({
  block,
  index,
}: {
  block: NewsBriefingBlock;
  index: string;
}) {
  return (
    <MajorSection>
      <SectionLabel index={index} label={block.data.englishLabel} />
      {block.data.items.map((item, i) => (
        <ItemGroup
          key={i}
          categoryTag={item.categoryTag}
          title={item.title}
          body={item.body}
          insight={item.insight}
          sourceUrl={item.sourceUrl}
          imageUrl={item.imageUrl}
          isLast={i === block.data.items.length - 1}
        />
      ))}
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// BLOCK: in_out_comparison
// ─────────────────────────────────────────────
function InOutComparison({
  block,
  index,
}: {
  block: InOutComparisonBlock;
  index: string;
}) {
  return (
    <MajorSection>
      <SectionLabel index={index} label={block.data.englishLabel} />
      <Row>
        <Column
          style={{
            verticalAlign: "top",
            paddingRight: "8px",
            width: "50%",
          }}
        >
          <InOutCard card={block.data.inItem} accent={colors.brandNavy} />
        </Column>
        <Column
          style={{
            verticalAlign: "top",
            paddingLeft: "8px",
            width: "50%",
          }}
        >
          <InOutCard card={block.data.outItem} accent={colors.accentGold} />
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
// BLOCK: tech_signal (light tinted, minimal style)
// ─────────────────────────────────────────────
function TechSignal({
  block,
  index,
}: {
  block: TechSignalBlock;
  index: string;
}) {
  return (
    <Section
      style={{
        backgroundColor: colors.bgTechAccent,
        padding: "36px 28px",
        borderRadius: "14px",
        margin: `${spacing.sectionVertical} 0`,
      }}
    >
      <Section style={{ marginBottom: "20px" }}>
        <Text style={{ ...typography.sectionLabel, margin: 0 }}>
          <span style={{ color: colors.accentGold }}>{index}</span>
          <span style={{ color: "rgba(46,48,146,0.25)", margin: "0 6px" }}>/</span>
          <span style={{ color: colors.brandNavy, opacity: 0.75 }}>
            {block.data.englishLabel.toUpperCase()}
          </span>
        </Text>
      </Section>

      <Section
        style={{
          backgroundColor: colors.bgWhite,
          border: `1px solid ${colors.borderTechAccent}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <Section
          style={{
            backgroundColor: colors.bgTechAccentSoft,
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
                ● {block.data.topicLabel}
              </Text>
            </Column>
            {block.data.topicMeta && (
              <Column align="right" style={{ verticalAlign: "middle" }}>
                <Text
                  style={{
                    fontSize: "10px",
                    color: colors.textSoft,
                    letterSpacing: "0.5px",
                    margin: 0,
                  }}
                >
                  {block.data.topicMeta}
                </Text>
              </Column>
            )}
          </Row>
        </Section>

        <Section style={{ padding: "24px" }}>
          <Heading
            as="h2"
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: colors.textHeadline,
              lineHeight: 1.4,
              letterSpacing: "-0.2px",
              margin: "0 0 16px 0",
            }}
          >
            {block.data.title}
          </Heading>
          <ImageWithBody
            src={block.data.imageUrl}
            layout={block.data.imageLayout}
          >
            {block.data.paragraphs.map((p, i) => (
              <Text
                key={i}
                style={{
                  fontSize: "13.5px",
                  color: colors.textBody,
                  lineHeight: 1.85,
                  fontWeight: 300,
                  margin: "0 0 16px 0",
                }}
                dangerouslySetInnerHTML={{ __html: renderInlineHtml(p) }}
              />
            ))}
          </ImageWithBody>
          <Section
            style={{
              backgroundColor: colors.bgInsightSoft,
              borderLeft: `3px solid ${colors.brandNavy}`,
              borderRadius: "0 8px 8px 0",
              padding: "14px 16px",
              marginTop: "12px",
            }}
          >
            <Text
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "2px",
                color: colors.brandNavy,
                textTransform: "uppercase",
                opacity: 0.7,
                margin: "0 0 6px 0",
              }}
            >
              MICE 관점
            </Text>
            <Text
              style={{
                fontSize: "12.5px",
                color: colors.textMuted,
                lineHeight: 1.75,
                fontWeight: 300,
                margin: 0,
              }}
              dangerouslySetInnerHTML={{
                __html: renderInlineHtml(block.data.miceInsight),
              }}
            />
          </Section>
        </Section>
      </Section>
    </Section>
  );
}

// ─────────────────────────────────────────────
// BLOCK: theory_to_field
// ─────────────────────────────────────────────
function TheoryToField({
  block,
  index,
}: {
  block: TheoryToFieldBlock;
  index: string;
}) {
  return (
    <MajorSection>
      <SectionLabel index={index} label={block.data.englishLabel} />
      {(block.data.sourceYear || block.data.sourceAuthor) && (
        <Section style={{ marginBottom: "18px" }}>
          <Row>
            {block.data.sourceYear && (
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
                  {block.data.sourceYear}
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
              {block.data.sourceAuthor && (
                <Text
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: colors.textMuted,
                    letterSpacing: "0.5px",
                    margin: "0 0 2px 0",
                  }}
                >
                  {block.data.sourceAuthor}
                </Text>
              )}
              {block.data.sourceMeta && (
                <Text
                  style={{
                    fontSize: "10px",
                    color: colors.textFaint,
                    fontStyle: "italic",
                    margin: 0,
                  }}
                >
                  {block.data.sourceMeta}
                </Text>
              )}
            </Column>
          </Row>
        </Section>
      )}

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
        {block.data.title}
      </Heading>

      <ImageWithBody
        src={block.data.imageUrl}
        layout={block.data.imageLayout}
      >
        {block.data.introParagraphs.map((p, i) => (
          <Text
            key={`intro-${i}`}
            style={{
              fontSize: "14px",
              color: colors.textBody,
              lineHeight: 1.95,
              fontWeight: 300,
              margin: "0 0 16px 0",
            }}
            dangerouslySetInnerHTML={{ __html: renderInlineHtml(p) }}
          />
        ))}
      </ImageWithBody>

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
          {block.data.bridge.label ?? "→ 현장에서는"}
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
            __html: renderInlineHtml(block.data.bridge.text),
          }}
        />
      </Section>

      {block.data.outroParagraphs.map((p, i) => (
        <Text
          key={`outro-${i}`}
          style={{
            fontSize: "14px",
            color: colors.textBody,
            lineHeight: 1.95,
            fontWeight: 300,
            margin: "0 0 16px 0",
          }}
          dangerouslySetInnerHTML={{ __html: renderInlineHtml(p) }}
        />
      ))}

      {block.data.closingNote && (
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
          {block.data.closingNote}
        </Text>
      )}
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// BLOCK: editor_take (지금 MICE는 / Editor's Take)
// ─────────────────────────────────────────────
function EditorTake({
  block,
  index,
}: {
  block: EditorTakeBlock;
  index: string;
}) {
  return (
    <MajorSection>
      <SectionLabel index={index} label={block.data.englishLabel} />
      {block.data.eyebrow && (
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
          {block.data.eyebrow}
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
        {renderMultiline(block.data.title)}
      </Heading>
      {block.data.leadParagraph && (
        <Text
          style={{
            fontSize: "14px",
            color: colors.textBody,
            lineHeight: 1.95,
            fontWeight: 300,
            margin: "0 0 8px 0",
          }}
        >
          {block.data.leadParagraph}
        </Text>
      )}
      {block.data.pullQuote && (
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
            &ldquo;{renderMultiline(block.data.pullQuote)}&rdquo;
          </Text>
        </Section>
      )}
      <ImageWithBody
        src={block.data.imageUrl}
        layout={block.data.imageLayout}
      >
        {block.data.paragraphs.map((p, i) => (
          <Text
            key={i}
            style={{
              fontSize: "14px",
              color: colors.textBody,
              lineHeight: 1.95,
              fontWeight: 300,
              margin: "0 0 16px 0",
            }}
            dangerouslySetInnerHTML={{ __html: renderInlineHtml(p) }}
          />
        ))}
      </ImageWithBody>
      {block.data.closingNote && (
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
          {block.data.closingNote}
        </Text>
      )}
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// BLOCK: groundk_story
// ─────────────────────────────────────────────
function GroundkStory({
  block,
  index,
}: {
  block: GroundkStoryBlock;
  index: string;
}) {
  return (
    <MajorSection noBorder>
      <SectionLabel index={index} label={block.data.englishLabel} />

      {/* Field Briefing — light tinted card */}
      <Section
        style={{
          backgroundColor: colors.bgFieldBriefing,
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
          {block.data.fieldBriefing.eyebrow}
        </Text>
        <Section
          style={{
            borderLeft: `3px solid ${colors.accentGold}`,
            paddingLeft: "14px",
          }}
        >
          <Text
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: colors.brandNavy,
              opacity: 0.7,
              margin: "0 0 4px 0",
            }}
          >
            {block.data.fieldBriefing.categoryTag}
          </Text>
          <ImageWithBody
            src={block.data.fieldBriefing.imageUrl}
            layout={block.data.fieldBriefing.imageLayout}
          >
            <Text
              style={{
                fontSize: "13px",
                color: colors.textBody,
                lineHeight: 1.85,
                fontWeight: 300,
                margin: 0,
                whiteSpace: "pre-line",
              }}
              dangerouslySetInnerHTML={{
                __html: renderInlineHtml(
                  block.data.fieldBriefing.body.replace(/\n/g, "<br>")
                ),
              }}
            />
          </ImageWithBody>
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
              {block.data.projectSketch.projectMeta}
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
              {block.data.projectSketch.dateMeta}
            </Text>
          </Column>
        </Row>
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
          {block.data.projectSketch.eyebrow}
        </Text>
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
          {block.data.projectSketch.title}
        </Heading>
        <ImageWithBody
          src={block.data.projectSketch.imageUrl}
          layout={block.data.projectSketch.imageLayout}
        >
          {block.data.projectSketch.paragraphs.map((p, i) => (
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
        </ImageWithBody>
        {block.data.projectSketch.tags.length > 0 && (
          <Section
            style={{
              paddingTop: "14px",
              borderTop: `1px solid ${colors.borderSoft}`,
              marginTop: "6px",
            }}
          >
            {block.data.projectSketch.tags.map((t, i) => (
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
// BLOCK: consolidated_insight — NEW single-topic chapter layout
// ─────────────────────────────────────────────
function ConsolidatedInsightSingleTopic({
  block,
  index,
}: {
  block: ConsolidatedInsightBlock;
  index: string;
}) {
  const chapters = block.data.chapters ?? [];
  return (
    <MajorSection>
      <SectionLabel index={index} label={block.data.englishLabel} />

      {block.data.topicLabel && (
        <Text
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "2px",
            color: colors.brandNavy,
            textTransform: "uppercase",
            opacity: 0.75,
            margin: "0 0 6px 0",
          }}
        >
          {block.data.topicLabel}
        </Text>
      )}

      {block.data.topicMeta && (
        <Text
          style={{
            fontSize: "12px",
            color: colors.textSoft,
            margin: "0 0 10px 0",
          }}
        >
          {block.data.topicMeta}
        </Text>
      )}

      {block.data.title && (
        <Heading
          as="h2"
          style={{
            fontSize: "26px",
            fontWeight: 700,
            color: colors.textHeadline,
            lineHeight: 1.35,
            letterSpacing: "-0.4px",
            margin: "0 0 18px 0",
          }}
        >
          {block.data.title}
        </Heading>
      )}

      <ImageWithBody
        src={block.data.imageUrl}
        layout={block.data.imageLayout}
      >
        {block.data.leadParagraph ? (
          <Text
            style={{
              fontSize: "15px",
              color: colors.textBody,
              lineHeight: 1.9,
              fontWeight: 400,
              margin: "0 0 28px 0",
            }}
            dangerouslySetInnerHTML={{
              __html: renderInlineHtml(block.data.leadParagraph),
            }}
          />
        ) : null}
      </ImageWithBody>

      {chapters.map((ch, i) => (
        <Section
          key={i}
          style={{
            marginBottom: i === chapters.length - 1 ? "28px" : "40px",
            paddingTop: "24px",
            borderTop: `1px solid ${colors.borderSoft}`,
          }}
        >
          <Text
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "2.5px",
              color: colors.brandNavy,
              textTransform: "uppercase",
              margin: "0 0 10px 0",
            }}
          >
            {ch.chapterLabel}
          </Text>
          <Heading
            as="h3"
            style={{
              fontSize: "19px",
              fontWeight: 700,
              color: colors.textHeadline,
              lineHeight: 1.4,
              letterSpacing: "-0.3px",
              margin: "0 0 14px 0",
            }}
          >
            {ch.heading}
          </Heading>
          {ch.paragraphs.map((p, j) => (
            <Text
              key={j}
              style={{
                fontSize: "14px",
                color: colors.textBody,
                lineHeight: 1.9,
                fontWeight: 300,
                margin: "0 0 14px 0",
              }}
              dangerouslySetInnerHTML={{ __html: renderInlineHtml(p) }}
            />
          ))}
          {ch.pullQuote && (
            <Text
              style={{
                fontSize: "15px",
                fontWeight: 500,
                fontStyle: "italic",
                color: colors.textHeadline,
                lineHeight: 1.6,
                borderLeft: `3px solid ${colors.brandNavy}`,
                paddingLeft: "14px",
                margin: "18px 0 4px 0",
              }}
            >
              {ch.pullQuote}
            </Text>
          )}
        </Section>
      ))}

      {block.data.closingInsight && (
        <Section
          style={{
            backgroundColor: colors.bgInsight,
            padding: "22px 24px",
            borderRadius: "8px",
            marginTop: "12px",
          }}
        >
          <Text
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "2px",
              color: colors.textHeadline,
              textTransform: "uppercase",
              margin: "0 0 10px 0",
            }}
          >
            {block.data.closingInsight.label ?? "GroundK Take"}
          </Text>
          <Text
            style={{
              fontSize: "14px",
              color: colors.textBody,
              lineHeight: 1.85,
              margin: 0,
            }}
            dangerouslySetInnerHTML={{
              __html: renderInlineHtml(block.data.closingInsight.text),
            }}
          />
        </Section>
      )}
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// BLOCK: consolidated_insight — legacy multi-theme layout (fallback)
// ─────────────────────────────────────────────
function ConsolidatedInsight({
  block,
  index,
}: {
  block: ConsolidatedInsightBlock;
  index: string;
}) {
  // Prefer the new single-topic chapter-based layout; fall back to the
  // legacy multi-theme layout if the draft predates the schema change.
  if (block.data.chapters && block.data.chapters.length > 0) {
    return (
      <ConsolidatedInsightSingleTopic block={block} index={index} />
    );
  }

  const legacyParts = block.data.parts ?? [];
  return (
    <MajorSection>
      <SectionLabel index={index} label={block.data.englishLabel} />
      {legacyParts.map((part, i) => (
        <Section
          key={i}
          style={{
            marginBottom:
              i === legacyParts.length - 1 ? "0" : "48px",
            paddingBottom:
              i === legacyParts.length - 1
                ? "0"
                : "48px",
            borderBottom:
              i === legacyParts.length - 1
                ? "none"
                : `1px solid ${colors.borderSoft}`,
          }}
        >
          <Text
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "2px",
              color: colors.brandNavy,
              textTransform: "uppercase",
              opacity: 0.7,
              margin: "0 0 8px 0",
            }}
          >
            {part.categoryTag}
          </Text>
          <Heading
            as="h3"
            style={{
              fontSize: "21px",
              fontWeight: 700,
              color: colors.textHeadline,
              lineHeight: 1.4,
              letterSpacing: "-0.3px",
              margin: "0 0 14px 0",
            }}
          >
            {part.title}
          </Heading>
          {part.paragraphs.map((p, j) => (
            <Text
              key={j}
              style={{
                fontSize: "14px",
                color: colors.textBody,
                lineHeight: 1.9,
                fontWeight: 300,
                margin: "0 0 14px 0",
              }}
              dangerouslySetInnerHTML={{ __html: renderInlineHtml(p) }}
            />
          ))}
          {part.insight && (
            <Section
              style={{
                backgroundColor: colors.bgInsight,
                padding: "16px 18px",
                borderRadius: "6px",
                marginTop: "6px",
              }}
            >
              <Text
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  color: colors.textHeadline,
                  textTransform: "uppercase",
                  margin: "0 0 6px 0",
                }}
              >
                {part.insight.label ?? "Insight"}
              </Text>
              <Text
                style={{
                  fontSize: "13px",
                  color: "#555555",
                  lineHeight: 1.7,
                  margin: 0,
                }}
                dangerouslySetInnerHTML={{
                  __html: renderInlineHtml(part.insight.text),
                }}
              />
            </Section>
          )}
        </Section>
      ))}
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// BLOCK: blog_card_grid (Ver.2 2x2 cards)
// ─────────────────────────────────────────────
function BlogCardGrid({
  block,
  index,
}: {
  block: BlogCardGridBlock;
  index: string;
}) {
  // Pair cards into rows of 2 for email-safe layout
  const rows: Array<typeof block.data.cards> = [];
  for (let i = 0; i < block.data.cards.length; i += 2) {
    rows.push(block.data.cards.slice(i, i + 2));
  }
  return (
    <MajorSection>
      <SectionLabel index={index} label={block.data.englishLabel} />
      {rows.map((row, rowIdx) => (
        <Row key={rowIdx} style={{ marginBottom: rowIdx === rows.length - 1 ? "0" : "14px" }}>
          {row.map((card, i) => (
            <Column
              key={i}
              style={{
                verticalAlign: "top",
                width: "50%",
                paddingLeft: i === 1 ? "7px" : "0",
                paddingRight: i === 0 ? "7px" : "0",
              }}
            >
              <Section
                style={{
                  border: `1px solid ${colors.borderSoft}`,
                  borderRadius: "8px",
                  padding: "18px",
                }}
              >
                <Text
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "1.5px",
                    color: colors.brandNavy,
                    textTransform: "uppercase",
                    margin: "0 0 8px 0",
                  }}
                >
                  {card.label}
                </Text>
                <Heading
                  as="h4"
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: colors.textHeadline,
                    lineHeight: 1.4,
                    letterSpacing: "-0.2px",
                    margin: "0 0 10px 0",
                  }}
                >
                  {card.title}
                </Heading>
                <Text
                  style={{
                    fontSize: "12px",
                    color: colors.textMuted,
                    lineHeight: 1.7,
                    fontWeight: 300,
                    margin: "0 0 12px 0",
                  }}
                >
                  {card.description}
                </Text>
                <Link
                  href={card.linkUrl}
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: colors.brandNavy,
                    textDecoration: "none",
                    letterSpacing: "0.3px",
                  }}
                >
                  {card.linkText ?? "블로그에서 읽기 →"}
                </Link>
              </Section>
            </Column>
          ))}
          {/* Pad trailing empty column if odd count */}
          {row.length === 1 && (
            <Column style={{ width: "50%", paddingLeft: "7px" }}>&nbsp;</Column>
          )}
        </Row>
      ))}
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// Dispatcher — route each block to its renderer
// ─────────────────────────────────────────────
export function BlockRenderer({
  block,
  index,
}: {
  block: BlockInstance;
  index: string;
}) {
  switch (block.type) {
    case "opening_lede":
      return <OpeningLede block={block} />;
    case "stat_feature":
      return <StatFeature block={block} index={index} />;
    case "news_briefing":
      return <NewsBriefing block={block} index={index} />;
    case "in_out_comparison":
      return <InOutComparison block={block} index={index} />;
    case "tech_signal":
      return <TechSignal block={block} index={index} />;
    case "theory_to_field":
      return <TheoryToField block={block} index={index} />;
    case "editor_take":
      return <EditorTake block={block} index={index} />;
    case "groundk_story":
      return <GroundkStory block={block} index={index} />;
    case "consolidated_insight":
      return <ConsolidatedInsight block={block} index={index} />;
    case "blog_card_grid":
      return <BlogCardGrid block={block} index={index} />;
    default: {
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}

/** Whether a block type is numbered in the section label */
export function isNumberedBlock(type: BlockInstance["type"]): boolean {
  return type !== "opening_lede";
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
 * Inline image renderer for newsletter blocks.
 * Keeps consistent styling (rounded corners, responsive width) and
 * only renders when `src` is a non-empty string.
 */
function BlockImage({
  src,
  alt = "",
  style,
}: {
  src?: string;
  alt?: string;
  style?: React.CSSProperties;
}) {
  if (!src) return null;
  return (
    <Img
      src={src}
      alt={alt}
      style={{
        display: "block",
        width: "100%",
        maxWidth: "100%",
        height: "auto",
        borderRadius: "8px",
        margin: "0 0 16px 0",
        ...style,
      }}
    />
  );
}

/**
 * Renders an image + body in one of five layouts chosen by the admin.
 *
 *   - full (default): 100%-width image above the body
 *   - small-top     : compact (max 320px) centered image above the body
 *   - small-bottom  : compact centered image below the body
 *   - left          : 2-col row, image ~40% on the left / body on the right
 *   - right         : mirrored
 *
 * When src is empty, this is equivalent to rendering body alone. Email
 * clients respect `align`-based 2-column tables fairly well, so left/right
 * are safe across Gmail / Outlook / Apple Mail.
 */
function ImageWithBody({
  src,
  layout,
  alt = "",
  children,
}: {
  src?: string;
  layout?: ImageLayout;
  alt?: string;
  children: React.ReactNode;
}) {
  if (!src) {
    return <>{children}</>;
  }

  const mode = layout ?? "full";

  if (mode === "full") {
    return (
      <>
        <BlockImage src={src} alt={alt} />
        {children}
      </>
    );
  }

  if (mode === "small-top" || mode === "small-bottom") {
    const imageNode = (
      <Section
        key="img"
        style={{
          textAlign: "center",
          marginBottom: mode === "small-top" ? "18px" : "0",
          marginTop: mode === "small-bottom" ? "18px" : "0",
        }}
      >
        <Img
          src={src}
          alt={alt}
          style={{
            display: "inline-block",
            width: "100%",
            maxWidth: "320px",
            height: "auto",
            borderRadius: "8px",
          }}
        />
      </Section>
    );
    return mode === "small-top" ? (
      <>
        {imageNode}
        {children}
      </>
    ) : (
      <>
        {children}
        {imageNode}
      </>
    );
  }

  // left / right — 2-column Row layout. Image column is ~40%. Use
  // valign=top so short-image / long-body stays aligned to the top.
  const imageCol = (
    <Column
      key="img"
      width="40%"
      style={{ verticalAlign: "top", paddingRight: mode === "left" ? "18px" : 0, paddingLeft: mode === "right" ? "18px" : 0 }}
    >
      <Img
        src={src}
        alt={alt}
        style={{
          display: "block",
          width: "100%",
          maxWidth: "100%",
          height: "auto",
          borderRadius: "8px",
        }}
      />
    </Column>
  );
  const bodyCol = (
    <Column
      key="body"
      width="60%"
      style={{ verticalAlign: "top" }}
    >
      {children}
    </Column>
  );
  return (
    <Row>
      {mode === "left" ? imageCol : bodyCol}
      {mode === "left" ? bodyCol : imageCol}
    </Row>
  );
}

// Re-export the Pill helper for consumers
export { Pill, BlockImage, ImageWithBody };
