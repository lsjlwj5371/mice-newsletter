/**
 * Primitive building blocks reused across newsletter sections.
 * All styles are inline for email client compatibility.
 */

import * as React from "react";
import { Section, Row, Column, Text, Heading, Hr, Img } from "@react-email/components";
import { colors, typography, spacing } from "../tokens";
import { renderInlineHtml } from "../helpers";

// ─────────────────────────────────────────────
// Section header — "01 / Number of the Month"
// ─────────────────────────────────────────────
export function SectionLabel({
  index,
  label,
}: {
  index?: string;
  label: string;
}) {
  return (
    <Section style={{ marginBottom: spacing.sectionHeaderGap }}>
      <Text
        style={{
          ...typography.sectionLabel,
          color: colors.textHeadline,
          margin: 0,
        }}
      >
        {index ? `${index} / ${label}` : label}
      </Text>
    </Section>
  );
}

export function SectionLabelOnDark({
  index,
  label,
}: {
  index?: string;
  label: string;
}) {
  return (
    <Section style={{ marginBottom: "24px" }}>
      <Text
        style={{
          ...typography.sectionLabel,
          color: colors.textOnDark,
          borderBottom: "1px solid rgba(255,255,255,0.2)",
          paddingBottom: "8px",
          margin: 0,
        }}
      >
        {index ? `${index} / ${label}` : label}
      </Text>
    </Section>
  );
}

// ─────────────────────────────────────────────
// Item group: category tag + title + body + optional insight + optional image
// ─────────────────────────────────────────────
export function ItemGroup({
  categoryTag,
  title,
  body,
  insight,
  sourceUrl,
  imageUrl,
  isLast = false,
}: {
  categoryTag?: string;
  title: string;
  body: string;
  insight?: { label?: string; text: string };
  sourceUrl?: string;
  imageUrl?: string;
  isLast?: boolean;
}) {
  return (
    <Section
      style={{
        marginBottom: isLast ? "0" : spacing.itemGroupGap,
      }}
    >
      {categoryTag && (
        <Text
          style={{
            ...typography.categoryTag,
            color: colors.brandNavy,
            margin: "0 0 6px 0",
          }}
        >
          {categoryTag}
        </Text>
      )}
      <Heading
        as="h2"
        style={{
          ...typography.itemTitle,
          color: colors.textHeadline,
          margin: "0 0 12px 0",
        }}
      >
        {title}
      </Heading>
      {imageUrl && (
        <Img
          src={imageUrl}
          alt=""
          style={{
            display: "block",
            width: "100%",
            maxWidth: "100%",
            height: "auto",
            borderRadius: "8px",
            margin: "0 0 14px 0",
          }}
        />
      )}
      <Text
        style={{
          ...typography.bodyText,
          color: colors.textBody,
          margin: "0 0 16px 0",
        }}
        dangerouslySetInnerHTML={{ __html: renderInlineHtml(body) }}
      />

      {/* sourceUrl is admin-opt-in: rendered as a compact button so
          readers actually notice it. Only shows when the admin has
          set a URL on this item. */}
      {sourceUrl && sourceUrl.trim() !== "" && (
        <Text style={{ margin: "-2px 0 14px 0", lineHeight: 1 }}>
          <a
            href={sourceUrl}
            style={{
              display: "inline-block",
              padding: "8px 14px",
              backgroundColor: colors.brandNavy,
              color: colors.textOnDark,
              border: "none",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.2px",
              textDecoration: "none",
            }}
          >
            원문 보기 →
          </a>
        </Text>
      )}
      {insight && <InsightBox label={insight.label} text={insight.text} />}
    </Section>
  );
}

// ─────────────────────────────────────────────
// Insight box (gray bg, "Insight" label + text)
// ─────────────────────────────────────────────
export function InsightBox({
  label = "Insight",
  text,
}: {
  label?: string;
  text: string;
}) {
  return (
    <Section
      style={{
        backgroundColor: colors.bgInsight,
        padding: spacing.insightBoxPadding,
        borderRadius: spacing.insightBoxRadius,
        marginTop: "16px",
      }}
    >
      <Text
        style={{
          ...typography.insightLabel,
          color: colors.textHeadline,
          margin: "0 0 8px 0",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          ...typography.insightText,
          color: "#555555",
          margin: 0,
        }}
        dangerouslySetInnerHTML={{ __html: renderInlineHtml(text) }}
      />

    </Section>
  );
}

// ─────────────────────────────────────────────
// Major section wrapper + ornamental divider trailing the section.
// Replaces the old `border-bottom` hairline with a centered gold
// diamond flanked by short hairlines — subtle but immediately makes
// the layout read as an edited magazine rather than a run-on document.
// ─────────────────────────────────────────────
export function MajorSection({
  children,
  noBorder = false,
  style,
}: {
  children: React.ReactNode;
  noBorder?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <>
      <Section
        style={{
          paddingTop: spacing.sectionVertical,
          paddingBottom: spacing.sectionVertical,
          ...style,
        }}
      >
        {children}
      </Section>
      {!noBorder && <SectionDivider />}
    </>
  );
}

/**
 * Decorative section separator — three evenly-spaced narrow hairlines
 * with a centered accent diamond. Uses a plain table row so every mail
 * client renders it identically; no CSS pseudo-elements or gradients.
 */
export function SectionDivider() {
  return (
    <Section
      style={{
        paddingTop: "14px",
        paddingBottom: "14px",
        textAlign: "center",
      }}
    >
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        width="60%"
        style={{
          margin: "0 auto",
          borderCollapse: "collapse",
          borderSpacing: 0,
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                borderBottom: `1px solid ${colors.borderSoft}`,
                height: "1px",
                fontSize: "0",
                lineHeight: "0",
              }}
            >
              &nbsp;
            </td>
            <td
              style={{
                padding: "0 14px",
                fontSize: "10px",
                lineHeight: 1,
                color: colors.accentGold,
                letterSpacing: "1px",
                whiteSpace: "nowrap",
              }}
            >
              ◆
            </td>
            <td
              style={{
                borderBottom: `1px solid ${colors.borderSoft}`,
                height: "1px",
                fontSize: "0",
                lineHeight: "0",
              }}
            >
              &nbsp;
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

// ─────────────────────────────────────────────
// Pill chip (used in GroundK Story for tags)
// ─────────────────────────────────────────────
export function Pill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "12px",
        color: colors.textMuted,
        border: `1px solid ${colors.borderPill}`,
        padding: "4px 10px",
        borderRadius: "20px",
        marginRight: "6px",
      }}
    >
      {label}
    </span>
  );
}

// Reused export to satisfy TS unused warnings if needed elsewhere
export { Row, Column, Hr };
