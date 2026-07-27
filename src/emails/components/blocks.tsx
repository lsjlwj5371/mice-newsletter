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
import { renderInlineHtml, renderMultiline } from "../helpers";
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
  InquiryCtaContent,
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
  EventRadarBlock,
  BlogCardGridBlock,
  PromoBannerBlock,
  SpecialArticleBlock,
  SpecialArticleItem,
  ImageLayout,
} from "@/types/newsletter";

// ─────────────────────────────────────────────
// FIXED: Header — brand wordmark
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

      {/* Header row: brand block on the left, issue meta badge on the
          right — masthead-style so the date + VOL are the first thing a
          reader's eye hits after the brand, without crowding the body.
          The .header-row className lets the mobile stylesheet collapse
          the row into a vertical stack below 480px so the tagline +
          description get full width for single-line rendering. */}
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        width="100%"
        className="header-row"
        style={{ borderCollapse: "collapse" }}
      >
        <tbody>
          <tr>
            <td
              style={{
                verticalAlign: "top",
                width: "68%",
              }}
            >
          {/* Wordmark: image if the admin uploaded a logo, otherwise
              the text wordmark with length-based auto-scaling. */}
          {content.wordmarkLogoUrl ? (
            <Img
              src={content.wordmarkLogoUrl}
              alt={content.wordmark || "Logo"}
              style={{
                display: "inline-block",
                height: `${content.wordmarkLogoHeight ?? 64}px`,
                width: "auto",
                verticalAlign: "middle",
              }}
            />
          ) : (
            <span
              style={{
                display: "inline-block",
                fontSize: `${
                  content.wordmarkFontSize ??
                  autoWordmarkFontSize(content.wordmark)
                }px`,
                fontWeight: content.wordmarkFontWeight ?? 900,
                lineHeight: 0.95,
                color: content.wordmarkColor ?? colors.textHeadline,
                letterSpacing: `${content.wordmarkLetterSpacing ?? -1}px`,
                fontFamily:
                  "'Pretendard', 'Impact', 'Arial Black', Arial, sans-serif",
              }}
            >
              {renderWordmarkWithDiamond(
                content.wordmark,
                content.wordmarkColor
              )}
            </span>
          )}
          <span
            className="header-tagline"
            style={{
              display: "inline-block",
              marginLeft: "14px",
              fontSize: "16px",
              fontWeight: 400,
              color: colors.textMuted,
              verticalAlign: "middle",
              letterSpacing: "-0.1px",
              whiteSpace: "nowrap",
            }}
          >
            {content.tagline}
          </span>
          <Text
            className="header-description"
            style={{
              fontSize: "16px",
              color: colors.textSoft,
              fontWeight: 400,
              margin: "10px 0 0 0",
              whiteSpace: "nowrap",
            }}
          >
            {content.description}
          </Text>
            </td>
            <td
              className="header-meta-col"
              style={{
                verticalAlign: "top",
                width: "32%",
                paddingLeft: "16px",
                textAlign: "right",
              }}
            >
              <IssueMetaBadge content={content} />
              {/* 지난 호 보기 버튼 — VOL 배지 아래 여백을 활용해 아카이브
                  링크를 노출. groundk.co.kr/ko/newsletter 로 이동. 배지
                  스타일(그레이 보더 + soft 배경) 과 결이 같은 outlined
                  pill 형태로 배지와 시각적 대구를 이룬다. */}
              <div style={{ marginTop: "10px" }}>
                <Link
                  href="https://groundk.co.kr/ko/newsletter"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: colors.textMuted,
                    textDecoration: "none",
                    letterSpacing: "0.3px",
                    border: `1px solid ${colors.borderSoft}`,
                    borderRadius: "4px",
                    backgroundColor: "#fafbfc",
                  }}
                >
                  지난 호 보기 →
                </Link>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

/**
 * Masthead-style badge for the issue number + date, docked to the
 * header's right column. New structured fields (issueNumber /
 * issueDate) are preferred; legacy drafts that only have the flat
 * issueMeta string render it as the single-line fallback.
 */
function IssueMetaBadge({ content }: { content: HeaderContent }) {
  // 방어층 — 어떤 이유로 issueNumber 가 유실됐지만 issueMeta 가 "N호"
  // 형태면 N 을 뽑아 VOL 큰 글씨 경로로 렌더. 템플릿 저장 시 propagation
  // 이 issueNumber 를 지우던 버그(2025-12) 로 이미 저장된 draft 는
  // DB 상 issueNumber = undefined 인 상태 → 렌더 시점에 복원.
  const derivedIssueNumber =
    content.issueNumber !== undefined
      ? content.issueNumber
      : deriveIssueNumberFromMeta(content.issueMeta);

  const hasStructured =
    derivedIssueNumber !== undefined || Boolean(content.issueDate);
  const hasLegacy = Boolean(content.issueMeta);
  if (!hasStructured && !hasLegacy) return null;

  return (
    <div
      className="issue-meta-badge"
      style={{
        display: "inline-block",
        textAlign: "right",
        padding: "8px 12px",
        border: `1px solid ${colors.borderSoft}`,
        borderRadius: "6px",
        backgroundColor: "#fafbfc",
        minWidth: "110px",
      }}
    >
      {hasStructured ? (
        <>
          <Text
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: colors.textFaint,
              letterSpacing: "2px",
              textTransform: "uppercase",
              margin: "0 0 4px 0",
              lineHeight: 1,
            }}
          >
            Issue
            {content.issueDate
              ? ` · ${formatIssueDate(content.issueDate)}`
              : ""}
          </Text>
          {derivedIssueNumber !== undefined && (
            <Text
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: colors.textHeadline,
                letterSpacing: "1px",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              VOL {formatIssueNumber(derivedIssueNumber)}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: colors.textFaint,
              letterSpacing: "2px",
              textTransform: "uppercase",
              margin: "0 0 4px 0",
              lineHeight: 1,
            }}
          >
            Issue
          </Text>
          <Text
            style={{
              fontSize: "12px",
              color: colors.textMuted,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {content.issueMeta}
          </Text>
        </>
      )}
    </div>
  );
}

/** YYYY-MM-DD → YYYY.MM.DD. Leaves any other format (e.g. "2026.04") alone. */
function formatIssueDate(raw: string): string {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}.${iso[2]}.${iso[3]}`;
  return raw;
}

/** 1 → "001", 7 → "007", 42 → "042", 1000 → "1000". */
function formatIssueNumber(n: number): string {
  return n.toString().padStart(3, "0");
}

/**
 * issueMeta 문자열에서 호 번호를 추출한다. issueNumber 필드가 유실된
 * 옛/버그 draft 를 위한 폴백 — 새 호 생성 시 사용된 다음 포맷을 지원:
 *   - "5호"          → 5
 *   - "VOL 005"       → 5
 *   - "VOL.005"       → 5
 *   - "VOL.01 · 2026년 4월호" (샘플 포맷) → 1
 * 인식 못 하면 undefined 반환 → 기존 legacy 폴백 경로 유지.
 */
function deriveIssueNumberFromMeta(meta?: string): number | undefined {
  if (!meta) return undefined;
  const s = meta.trim();
  // 1) "VOL 005" / "VOL.005" / "VOL.01" — VOL 뒤 첫 숫자군
  const vol = s.match(/VOL[.\s]*(\d+)/i);
  if (vol) {
    const n = parseInt(vol[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  // 2) "5호" — 숫자 뒤에 "호" 붙는 한국식
  const kor = s.match(/^(\d+)\s*호\b/);
  if (kor) {
    const n = parseInt(kor[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/**
 * Render the wordmark with the last character styled as an accent
 * (e.g. the "I" rendered in navy while P and K are black). Uses a simple
 * heuristic: if the wordmark contains recognized accent letters, color the
 * last one navy. Otherwise render plain.
 */
function renderWordmarkWithDiamond(
  wordmark: string,
  customColor?: string
): React.ReactNode {
  const chars = Array.from(wordmark);
  if (chars.length === 0) return wordmark;
  // When the admin has chosen an explicit wordmarkColor, honor it across
  // the entire string — disable the per-character navy accent so the
  // color choice actually shows through.
  if (customColor) {
    return (
      <span style={{ color: customColor }}>{wordmark}</span>
    );
  }
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

/**
 * Pick a sensible default font size based on wordmark length. Keeps the
 * classic 56px for 1–4 character wordmarks and steps down for longer
 * brand strings so "MICE 人 Insight" doesn't overflow the column.
 * Admin can always override via wordmarkFontSize on the template.
 */
function autoWordmarkFontSize(wordmark: string): number {
  const len = Array.from(wordmark).length;
  if (len <= 4) return 56;
  if (len <= 7) return 44;
  if (len <= 11) return 34;
  if (len <= 15) return 28;
  return 24;
}

/**
 * "원문 보기 →" link rendered as a compact button block so readers
 * actually notice it — the earlier inline gray link was nearly
 * invisible against body text. Emits nothing when the URL is empty.
 *
 * Style notes (email-safe):
 *   - inline-block `<a>` with padding/border emulates a button across
 *     Gmail / Outlook / Apple Mail without needing <table> hacks.
 *   - neutral palette (navy border + bg tint) so it doesn't compete
 *     with the referral CTA, which is the page-level action.
 */
function SourceLink({
  url,
  topMargin = "16px",
}: {
  url?: string;
  topMargin?: string;
}) {
  if (!url || url.trim() === "") return null;
  return (
    <Text style={{ margin: `${topMargin} 0 0 0`, lineHeight: 1 }}>
      <Link
        href={url}
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
      </Link>
    </Text>
  );
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
        marginTop: "60px",
        paddingTop: "32px",
        borderTop: `2px solid ${colors.borderStrong}`,
      }}
    >
      <div
        style={{
          backgroundColor: colors.bgInsight,
          padding: "22px 24px",
          borderRadius: "8px",
        }}
      >
      {/* Native <table> (instead of React-Email Row/Column) so the
          .cta-row className can be targeted by the mobile stylesheet to
          collapse into a single column below 480px. */}
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        width="100%"
        className="cta-row"
        style={{ borderCollapse: "collapse" }}
      >
        <tbody>
          <tr>
            <td style={{ verticalAlign: "middle" }}>
              <Text
                style={{
                  fontSize: "16px",
                  lineHeight: 1.7,
                  color: colors.textBody,
                  fontWeight: 400,
                  margin: 0,
                }}
              >
                {content.message}
              </Text>
            </td>
            <td
              className="cta-button-col"
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
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────
// FIXED: Inquiry CTA — referralCta 와 동일 디자인. 푸터 직전에 렌더되며,
//        buttonHref 가 비어있거나 content.inquiryCta 자체가 없으면
//        섹션을 통째로 건너뛴다 (마이그레이션 0021 이전 호 호환).
// ─────────────────────────────────────────────
export function InquiryCtaBlock({
  content,
}: {
  content?: InquiryCtaContent;
}) {
  // 옵션 가드 — 미설정 / 빈 URL 이면 렌더하지 않음.
  if (!content || !content.buttonHref || content.buttonHref.trim() === "") {
    return null;
  }
  return (
    <Section
      style={{
        marginTop: "24px",
        paddingTop: "24px",
        borderTop: `1px solid ${colors.borderSoft}`,
      }}
    >
      <div
        style={{
          backgroundColor: colors.bgInsightSoft,
          padding: "20px 24px",
          borderRadius: "8px",
        }}
      >
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          width="100%"
          className="cta-row"
          style={{ borderCollapse: "collapse" }}
        >
          <tbody>
            <tr>
              <td style={{ verticalAlign: "middle" }}>
                <Text
                  style={{
                    fontSize: "15px",
                    lineHeight: 1.7,
                    color: colors.textBody,
                    fontWeight: 400,
                    margin: 0,
                  }}
                >
                  {content.message}
                </Text>
              </td>
              <td
                className="cta-button-col"
                align="right"
                style={{ verticalAlign: "middle", width: "140px" }}
              >
                <Link
                  href={content.buttonHref}
                  target="_blank"
                  rel="noopener noreferrer"
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
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
  // Centered footer composition:
  //   1) Unsubscribe line (with inline "여기" link)
  //   2) "MICE人 Sponsored by GroundK" — brand wordmarks inline-colored
  //   3) Two circular gray logos side-by-side (MICE人 + GroundK)
  const miceLogoSrc = `${appUrl}/footer-mice-logo.png`;
  const groundkLogoSrc = `${appUrl}/footer-groundk-logo.jpg`;

  // Wrap a logo image in a Link when an href is configured, otherwise
  // render the bare Img — keeps the footer valid even while one of the
  // brand URLs is still TBD.
  const wrapInLink = (node: React.ReactNode, href?: string) =>
    href && href.trim() !== "" ? (
      <Link href={href} style={{ textDecoration: "none" }}>
        {node}
      </Link>
    ) : (
      node
    );

  const miceLogoImg = (
    <Img
      src={miceLogoSrc}
      alt="MICE人"
      width="56"
      height="56"
      style={{
        display: "block",
        width: "56px",
        height: "56px",
      }}
    />
  );
  const groundkLogoImg = (
    <Img
      src={groundkLogoSrc}
      alt="GroundK"
      width="56"
      height="56"
      style={{
        display: "block",
        width: "56px",
        height: "56px",
      }}
    />
  );

  return (
    <Section
      style={{
        marginTop: "32px",
        paddingTop: "0",
        paddingBottom: "40px",
        textAlign: "center",
      }}
    >
      {/* Row 1: unsubscribe notice — centered, one line on desktop */}
      <Text
        style={{
          ...typography.footerSmall,
          color: colors.textMuted,
          textAlign: "center",
          margin: "0 0 18px 0",
        }}
      >
        수신을 원치 않으시면{" "}
        <Link
          href={content.unsubscribeHref}
          style={{
            color: colors.textHeadline,
            textDecoration: "underline",
            fontWeight: 600,
          }}
        >
          여기
        </Link>
        에서 수신 거부하실 수 있습니다.
      </Text>

      {/* Row 2: "MICE人 Sponsored by GroundK" with brand colors. */}
      <Text
        style={{
          fontSize: "14px",
          fontWeight: 700,
          textAlign: "center",
          margin: "0 0 16px 0",
          letterSpacing: "-0.1px",
        }}
      >
        <span style={{ color: "#C51C69" }}>MICE人</span>
        <span style={{ color: colors.textMuted, fontWeight: 400 }}>
          {" "}Sponsored by{" "}
        </span>
        <span style={{ color: "#2E3092" }}>GroundK</span>
      </Text>

      {/* Row 3: two circular gray brand logos, centered side-by-side.
          Wrapped in a <table> so email clients render the two images
          on the same row reliably (flexbox/inline-block gets
          inconsistent treatment across Outlook). */}
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        align="center"
        style={{
          margin: "0 auto",
          borderCollapse: "collapse",
        }}
      >
        <tbody>
          <tr>
            <td style={{ padding: "0 8px" }}>
              {wrapInLink(miceLogoImg, content.miceLogoHref)}
            </td>
            <td style={{ padding: "0 8px" }}>
              {wrapInLink(groundkLogoImg, content.groundkLogoHref)}
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

// ─────────────────────────────────────────────
// BLOCK: opening_lede
// ─────────────────────────────────────────────
function OpeningLede({
  block,
  isLast,
}: {
  block: OpeningLedeBlock;
  isLast?: boolean;
}) {
  return (
    <MajorSection
      noBorder
      isLast={isLast}
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
          <SourceLink url={block.data.sourceUrl} topMargin="16px" />
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
  isLast,
}: {
  block: StatFeatureBlock;
  index: string;
  isLast?: boolean;
}) {
  return (
    <MajorSection isLast={isLast}>
      <SectionLabel
        index={index}
        label={block.data.englishLabel}
        emoji="📊"
      />
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
        <SourceLink url={block.data.sourceUrl} topMargin="10px" />
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
  isLast,
}: {
  block: NewsBriefingBlock;
  index: string;
  isLast?: boolean;
}) {
  return (
    <MajorSection isLast={isLast}>
      <SectionLabel
        index={index}
        label={block.data.englishLabel}
        emoji="📰"
      />
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
  isLast,
}: {
  block: InOutComparisonBlock;
  index: string;
  isLast?: boolean;
}) {
  // 세로 스택 레이아웃 — IN(국내) 위, OUT(글로벌) 아래.
  // 이전 버전은 2-col 좌우 분할이었지만, 본문이 길어지면 한 컬럼이
  // 다른 컬럼보다 수직으로 늘어나면서 카드 높이가 길게 어긋나 가독성이
  // 떨어졌다. 풀폭 스택으로 바꿔서 각 카드에 본문 폭(640px) 을 그대로
  // 주고, 카드 사이 12px 간격으로 시각적으로 분리.
  return (
    <MajorSection isLast={isLast}>
      <SectionLabel
        index={index}
        label={block.data.englishLabel}
        emoji="🌏"
      />
      <div style={{ marginBottom: "12px" }}>
        <InOutCard card={block.data.inItem} accent={colors.brandNavy} />
      </div>
      <InOutCard card={block.data.outItem} accent={colors.accentGold} />
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
          {renderMultiline(card.title)}
        </Heading>
        <Text
          style={{
            fontSize: "16px",
            color: colors.textMuted,
            lineHeight: 1.75,
            margin: "0 0 12px 0",
            fontWeight: 400,
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
        <SourceLink url={card.sourceUrl} topMargin="8px" />
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
  isLast,
}: {
  block: TechSignalBlock;
  index: string;
  isLast?: boolean;
}) {
  return (
    <MajorSection isLast={isLast}>
      <SectionLabel
        index={index}
        label={block.data.englishLabel}
        emoji="💡"
      />

      {/* Topic tag (accent gold) + date meta — kept as inline identifiers
          because tech_signal tracks "이달의 테크 키워드". Flattened into
          the block body now that the outer tinted card is gone. */}
      <Text
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "2px",
          color: colors.accentGold,
          textTransform: "uppercase",
          margin: "0 0 6px 0",
        }}
      >
        ● {block.data.topicLabel}
      </Text>
      {block.data.topicMeta && (
        <Text
          style={{
            fontSize: "12px",
            color: colors.textSoft,
            letterSpacing: "0.3px",
            margin: "0 0 14px 0",
          }}
        >
          {block.data.topicMeta}
        </Text>
      )}

      <Heading
        as="h2"
        style={{
          fontSize: "22px",
          fontWeight: 700,
          color: colors.textHeadline,
          lineHeight: 1.35,
          letterSpacing: "-0.3px",
          margin: "0 0 16px 0",
        }}
      >
        {renderMultiline(block.data.title)}
      </Heading>

      <ImageWithBody
        src={block.data.imageUrl}
        layout={block.data.imageLayout}
      >
        {block.data.paragraphs.map((p, i) => (
          <Text
            key={i}
            style={{
              fontSize: "16px",
              color: colors.textBody,
              lineHeight: 1.85,
              fontWeight: 400,
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
            fontSize: "14px",
            color: colors.textBody,
            lineHeight: 1.75,
            fontWeight: 400,
            margin: 0,
          }}
          dangerouslySetInnerHTML={{
            __html: renderInlineHtml(block.data.miceInsight),
          }}
        />
      </Section>

      <SourceLink url={block.data.sourceUrl} topMargin="14px" />
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// BLOCK: theory_to_field
// ─────────────────────────────────────────────
function TheoryToField({
  block,
  index,
  isLast,
}: {
  block: TheoryToFieldBlock;
  index: string;
  isLast?: boolean;
}) {
  return (
    <MajorSection isLast={isLast}>
      <SectionLabel
        index={index}
        label={block.data.englishLabel}
        emoji="📚"
      />
      {(block.data.sourceYear ||
        block.data.sourceAuthor ||
        block.data.sourcePaperTitle) && (
        <Section style={{ marginBottom: "18px" }}>
          <Row>
            {block.data.sourceYear && (
              <Column
                style={{
                  // 32px bold "2026" actually measures ~70-75px depending on
                  // the client's font. 70px was right at the edge and Gmail
                  // mobile / narrow webview broke it onto two lines (the
                  // "202" / "6" wrap the user reported). Bumped to 84px so
                  // we have a comfortable char of headroom; nowrap below
                  // is the real guarantee — width is just for layout.
                  width: "84px",
                  verticalAlign: "middle",
                  whiteSpace: "nowrap",
                }}
              >
                <Text
                  style={{
                    fontSize: "32px",
                    color: colors.accentGold,
                    opacity: 0.6,
                    lineHeight: 1,
                    margin: 0,
                    fontWeight: 700,
                    // Force single-line render regardless of column width.
                    // Even if a future client computes the Column narrower
                    // than 84px, the year stays on one line (would overflow
                    // before wrapping, which is acceptable for a 4-digit number).
                    whiteSpace: "nowrap",
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
              {block.data.sourcePaperTitle ? (
                <>
                  {/* 신규 레이아웃 — sourcePaperTitle 세팅된 draft 에만 적용.
                      Line 1: 논문 정식 명칭 (굵게)
                      Line 2: 저널명 · Volume + " | " + 저자들 (한 줄) */}
                  <Text
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: colors.textHeadline,
                      letterSpacing: "-0.1px",
                      lineHeight: 1.4,
                      margin: "0 0 4px 0",
                    }}
                  >
                    {block.data.sourcePaperTitle}
                  </Text>
                  {(block.data.sourceMeta || block.data.sourceAuthor) && (
                    <Text
                      style={{
                        fontSize: "10px",
                        color: colors.textFaint,
                        fontStyle: "italic",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {[block.data.sourceMeta, block.data.sourceAuthor]
                        .filter((v) => v && v.trim() !== "")
                        .join(" | ")}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  {/* 레거시 레이아웃 — sourcePaperTitle 없는 이전 호는 그대로.
                      Line 1: 저자 (bold small)
                      Line 2: 저널 (italic faint) */}
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
                </>
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
        {renderMultiline(block.data.title)}
      </Heading>

      <ImageWithBody
        src={block.data.imageUrl}
        layout={block.data.imageLayout}
      >
        {block.data.introParagraphs.map((p, i) => (
          <Text
            key={`intro-${i}`}
            style={{
              fontSize: "16px",
              color: colors.textBody,
              lineHeight: 1.95,
              fontWeight: 400,
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
            fontSize: "16px",
            color: colors.textBody,
            lineHeight: 1.85,
            fontWeight: 400,
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
            fontSize: "16px",
            color: colors.textBody,
            lineHeight: 1.95,
            fontWeight: 400,
            margin: "0 0 16px 0",
          }}
          dangerouslySetInnerHTML={{ __html: renderInlineHtml(p) }}
        />
      ))}

      {block.data.closingNote && (
        <Text
          style={{
            fontSize: "16px",
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
      {block.data.sourceUrl && block.data.sourceUrl.trim() !== "" && (
        <Text
          style={{
            fontSize: "12px",
            color: colors.textSoft,
            margin: "14px 0 0 0",
          }}
        >
          <Link
            href={block.data.sourceUrl}
            style={{
              color: colors.textSoft,
              textDecoration: "underline",
            }}
          >
            원문 보기 →
          </Link>
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
  isLast,
}: {
  block: EditorTakeBlock;
  index: string;
  isLast?: boolean;
}) {
  return (
    <MajorSection isLast={isLast}>
      <SectionLabel
        index={index}
        label={block.data.englishLabel}
        emoji="✏️"
      />
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
            fontSize: "16px",
            color: colors.textBody,
            lineHeight: 1.95,
            fontWeight: 400,
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
              fontSize: "16px",
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
              fontSize: "16px",
              color: colors.textBody,
              lineHeight: 1.95,
              fontWeight: 400,
              margin: "0 0 16px 0",
            }}
            dangerouslySetInnerHTML={{ __html: renderInlineHtml(p) }}
          />
        ))}
      </ImageWithBody>
      {block.data.closingNote && (
        <Text
          style={{
            fontSize: "16px",
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
      <SourceLink url={block.data.sourceUrl} topMargin="14px" />
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// BLOCK: groundk_story
// ─────────────────────────────────────────────
function GroundkStory({
  block,
  index,
  isLast,
}: {
  block: GroundkStoryBlock;
  index: string;
  isLast?: boolean;
}) {
  // Missing flag is treated as "show" so pre-existing drafts keep both parts.
  const showFieldBriefing = block.data.showFieldBriefing !== false;
  const showProjectSketch = block.data.showProjectSketch !== false;

  return (
    <MajorSection noBorder isLast={isLast}>
      <SectionLabel
        index={index}
        label={block.data.englishLabel}
        emoji="🎯"
      />

      {/* Field Briefing — light tinted card */}
      {showFieldBriefing && (
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
                fontSize: "16px",
                color: colors.textBody,
                lineHeight: 1.85,
                fontWeight: 400,
                margin: 0,
                // whiteSpace: pre-line 을 의도적으로 제거했습니다.
                // 단락 구분은 위 `body.replace(/\n/g, "<br>")` + renderInlineHtml
                // 파이프라인이 명시적인 <br/> 태그로 이미 처리하므로 CSS 레벨
                // 줄바꿈 보존이 중복입니다. 오히려 NCP 처럼 HTML 을 외부 에디터에
                // 붙여넣어 발송하는 경로에서 코드 포매터가 가독성용으로 끼워넣는
                // raw newline 까지 시각적 줄바꿈으로 렌더되어 본문이 잘게 끊기는
                // 버그의 원인이 됐습니다 — 우리 시스템 발송에선 직렬화 방식이
                // 달라 표면화하지 않았습니다.
              }}
              dangerouslySetInnerHTML={{
                __html: renderInlineHtml(
                  block.data.fieldBriefing.body.replace(/\n/g, "<br>")
                ),
              }}
            />
          </ImageWithBody>
          <SourceLink
            url={block.data.fieldBriefing.sourceUrl}
            topMargin="12px"
          />
        </Section>
      </Section>
      )}

      {/* Project Sketch — light card */}
      {showProjectSketch && (
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
                fontSize: "16px",
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
        <SourceLink
          url={block.data.projectSketch.sourceUrl}
          topMargin="14px"
        />
      </Section>
      )}
    </MajorSection>
  );
}

// ─────────────────────────────────────────────
// BLOCK: consolidated_insight — NEW single-topic chapter layout
// ─────────────────────────────────────────────
function ConsolidatedInsightSingleTopic({
  block,
  index,
  isLast,
}: {
  block: ConsolidatedInsightBlock;
  index: string;
  isLast?: boolean;
}) {
  const chapters = block.data.chapters ?? [];
  const hasImage =
    !!block.data.imageUrl && block.data.imageUrl.trim() !== "";

  return (
    <MajorSection isLast={isLast}>
      <SectionLabel
        index={index}
        label={block.data.englishLabel}
        emoji="🔍"
      />

      {/* Full-bleed hero — td-background overlay, no CSS gradient.
          Admin bakes any gradient effect directly into the uploaded
          image, so the HTML side only provides the text overlay.

          Structure (same as the pre-revert 'bulletproof' version):
            <div>                                ← full-bleed wrapper
              <table><tr>
                <td background={url}             ← image as cell bg
                    valign="bottom" height=320>
                  <div class="hero-overlay">     ← chip/title/meta
                </td>
              </tr></table>
            </div>

          Works across Apple Mail / Gmail (web+app) / Naver / Daum.
          Outlook desktop falls back to bgcolor (solid #14152a) + the
          overlay text — loses only the background image. Tweak from
          the earlier version: the linear-gradient `backgroundImage`
          on the overlay div is GONE, because the admin's uploaded
          image already carries its own gradient. */}
      <div
        style={{
          marginTop: "4px",
          marginBottom: "24px",
          marginLeft: "-16px",
          marginRight: "-16px",
          backgroundColor: "#14152a",
          overflow: "hidden",
        }}
      >
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          width="100%"
          style={{ borderCollapse: "collapse" }}
        >
          <tbody>
            <tr>
              <td
                className="hero-cell"
                {...({
                  ...(hasImage ? { background: block.data.imageUrl } : {}),
                  bgcolor: "#14152a",
                } as React.TdHTMLAttributes<HTMLTableCellElement>)}
                height={320}
                valign="bottom"
                style={{
                  ...(hasImage
                    ? {
                        backgroundImage: `url(${block.data.imageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                      }
                    : {
                        /* No image → flat dark panel; admin adds
                           any gradient treatment via the uploaded
                           image itself when one is present. */
                        backgroundColor: "#14152a",
                      }),
                  height: "320px",
                  verticalAlign: "bottom",
                }}
              >
                <div
                  className="hero-overlay"
                  style={{
                    padding: "90px 24px 24px 24px",
                    color: "#ffffff",
                  }}
                >
                  {block.data.topicLabel && (
                    <span
                      className="hero-chip"
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        backgroundColor: "rgba(255,255,255,0.15)",
                        border: "1px solid rgba(255,255,255,0.32)",
                        color: "#ffffff",
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "1.5px",
                        textTransform: "uppercase",
                        marginBottom: "10px",
                      }}
                    >
                      {block.data.topicLabel}
                    </span>
                  )}
                  {block.data.title && (
                    <Heading
                      as="h2"
                      className="hero-title"
                      style={{
                        fontSize: "26px",
                        fontWeight: 800,
                        color: "#ffffff",
                        lineHeight: 1.3,
                        letterSpacing: "-0.3px",
                        margin: "6px 0 0 0",
                      }}
                    >
                      {renderMultiline(block.data.title)}
                    </Heading>
                  )}
                  {block.data.topicMeta && (
                    <Text
                      className="hero-meta"
                      style={{
                        fontSize: "13px",
                        color: "rgba(255,255,255,0.85)",
                        lineHeight: 1.5,
                        margin: "10px 0 0 0",
                      }}
                    >
                      {block.data.topicMeta}
                    </Text>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Lead paragraph now sits under the hero in the normal flow.
          No ImageWithBody — hero is the image. */}
      {block.data.leadParagraph && (
        <Text
          style={{
            fontSize: "16px",
            color: colors.textBody,
            lineHeight: 1.9,
            fontWeight: 400,
            margin: "0 0 28px 0",
          }}
          dangerouslySetInnerHTML={{
            __html: renderInlineHtml(block.data.leadParagraph),
          }}
        />
      )}

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
            {renderMultiline(ch.heading)}
          </Heading>
          {ch.paragraphs.map((p, j) => (
            <Text
              key={j}
              style={{
                fontSize: "16px",
                color: colors.textBody,
                lineHeight: 1.9,
                fontWeight: 400,
                margin: "0 0 14px 0",
              }}
              dangerouslySetInnerHTML={{ __html: renderInlineHtml(p) }}
            />
          ))}
          {ch.pullQuote && (
            <Text
              style={{
                fontSize: "16px",
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

      {/* closingInsight (GROUNDK TAKE) is intentionally NOT rendered.
          The final chapter now carries the takeaway itself — a separate
          closing box duplicated the conclusion. Field is kept in the
          schema so older drafts don't fail validation. */}
      {block.data.sourceUrl && block.data.sourceUrl.trim() !== "" && (
        <Text
          style={{
            fontSize: "12px",
            color: colors.textSoft,
            margin: "16px 0 0 0",
          }}
        >
          <Link
            href={block.data.sourceUrl}
            style={{
              color: colors.textSoft,
              textDecoration: "underline",
            }}
          >
            원문 보기 →
          </Link>
        </Text>
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
  isLast,
}: {
  block: ConsolidatedInsightBlock;
  index: string;
  isLast?: boolean;
}) {
  // Prefer the new single-topic chapter-based layout; fall back to the
  // legacy multi-theme layout if the draft predates the schema change.
  if (block.data.chapters && block.data.chapters.length > 0) {
    return (
      <ConsolidatedInsightSingleTopic
        block={block}
        index={index}
        isLast={isLast}
      />
    );
  }

  const legacyParts = block.data.parts ?? [];
  return (
    <MajorSection isLast={isLast}>
      <SectionLabel
        index={index}
        label={block.data.englishLabel}
        emoji="🔍"
      />
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
                fontSize: "16px",
                color: colors.textBody,
                lineHeight: 1.9,
                fontWeight: 400,
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
                  fontSize: "16px",
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
// BLOCK: event_radar — upcoming events admins curate for the issue
// ─────────────────────────────────────────────
function EventRadar({
  block,
  index,
  isLast,
}: {
  block: EventRadarBlock;
  index: string;
  isLast?: boolean;
}) {
  return (
    <MajorSection isLast={isLast}>
      <SectionLabel
        index={index}
        label={block.data.englishLabel}
        emoji="📡"
      />
      {block.data.events.map((ev, i) => (
        <Section
          key={i}
          style={{
            marginBottom: i === block.data.events.length - 1 ? "0" : "24px",
            paddingBottom:
              i === block.data.events.length - 1 ? "0" : "24px",
            borderBottom:
              i === block.data.events.length - 1
                ? "none"
                : `1px solid ${colors.borderSoft}`,
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
            {ev.categoryTag}
          </Text>
          <Heading
            as="h3"
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: colors.textHeadline,
              lineHeight: 1.4,
              letterSpacing: "-0.2px",
              margin: "0 0 6px 0",
            }}
          >
            {renderMultiline(ev.title)}
          </Heading>
          <Text
            style={{
              fontSize: "12px",
              color: colors.textMuted,
              letterSpacing: "0.3px",
              margin: "0 0 12px 0",
            }}
          >
            📅 {ev.dateMeta}
          </Text>
          <ImageWithBody src={ev.imageUrl} layout={ev.imageLayout}>
            <Text
              style={{
                fontSize: "16px",
                color: colors.textBody,
                lineHeight: 1.85,
                fontWeight: 400,
                margin: "0 0 12px 0",
              }}
              dangerouslySetInnerHTML={{ __html: renderInlineHtml(ev.body) }}
            />
          </ImageWithBody>
          {ev.whyItMatters && (
            <Section
              style={{
                backgroundColor: colors.bgInsightSoft,
                borderLeft: `3px solid ${colors.brandNavy}`,
                borderRadius: "0 6px 6px 0",
                padding: "10px 14px",
                marginTop: "4px",
              }}
            >
              <Text
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  color: colors.brandNavy,
                  textTransform: "uppercase",
                  opacity: 0.7,
                  margin: "0 0 4px 0",
                }}
              >
                왜 주목해야 하나
              </Text>
              <Text
                style={{
                  fontSize: "12.5px",
                  color: colors.textBody,
                  lineHeight: 1.7,
                  fontWeight: 400,
                  margin: 0,
                }}
                dangerouslySetInnerHTML={{
                  __html: renderInlineHtml(ev.whyItMatters),
                }}
              />
            </Section>
          )}
          {/* sourceUrl is admin-opt-in per event. Button-style block
              for visibility; omitted when the admin hasn't set it. */}
          <SourceLink url={ev.sourceUrl} topMargin="14px" />

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
  isLast,
}: {
  block: BlogCardGridBlock;
  index: string;
  isLast?: boolean;
}) {
  // Pair cards into rows of 2 for email-safe layout
  const rows: Array<typeof block.data.cards> = [];
  for (let i = 0; i < block.data.cards.length; i += 2) {
    rows.push(block.data.cards.slice(i, i + 2));
  }
  return (
    <MajorSection isLast={isLast}>
      <SectionLabel
        index={index}
        label={block.data.englishLabel}
        emoji="📝"
      />
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
                    fontSize: "16px",
                    fontWeight: 700,
                    color: colors.textHeadline,
                    lineHeight: 1.4,
                    letterSpacing: "-0.2px",
                    margin: "0 0 10px 0",
                  }}
                >
                  {renderMultiline(card.title)}
                </Heading>
                <Text
                  style={{
                    fontSize: "12px",
                    color: colors.textMuted,
                    lineHeight: 1.7,
                    fontWeight: 400,
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
  isLast,
}: {
  block: BlockInstance;
  index: string;
  /** Set on the final block of the issue; suppresses its trailing
   *  section divider + tightens bottom padding before the footer. */
  isLast?: boolean;
}) {
  switch (block.type) {
    case "opening_lede":
      return <OpeningLede block={block} isLast={isLast} />;
    case "stat_feature":
      return <StatFeature block={block} index={index} isLast={isLast} />;
    case "news_briefing":
      return <NewsBriefing block={block} index={index} isLast={isLast} />;
    case "in_out_comparison":
      return (
        <InOutComparison block={block} index={index} isLast={isLast} />
      );
    case "tech_signal":
      return <TechSignal block={block} index={index} isLast={isLast} />;
    case "theory_to_field":
      return <TheoryToField block={block} index={index} isLast={isLast} />;
    case "editor_take":
      return <EditorTake block={block} index={index} isLast={isLast} />;
    case "groundk_story":
      return <GroundkStory block={block} index={index} isLast={isLast} />;
    case "consolidated_insight":
      return (
        <ConsolidatedInsight block={block} index={index} isLast={isLast} />
      );
    case "event_radar":
      return <EventRadar block={block} index={index} isLast={isLast} />;
    case "blog_card_grid":
      return <BlogCardGrid block={block} index={index} isLast={isLast} />;
    case "promo_banner":
      return <PromoBanner block={block} isLast={isLast} />;
    case "special_article":
      return <SpecialArticle block={block} index={index} isLast={isLast} />;
    default: {
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}

// ─────────────────────────────────────────────
// BLOCK: promo_banner — 가로 풀폭 홍보 배너
// ─────────────────────────────────────────────
// 카드의 좌우 16px 패딩을 negative margin 으로 무시하고 가로 꽉 채움.
// 챕터 라벨/제목 없음, 이미지만. linkUrl 이 있으면 <a> 로 감쌈.
// 권장 이미지 비율 3:1 (1280×426). 업로드 라우트가 variant=hero 로
// 1280px 와이드 리사이즈 → desktop 640px 표시.
function PromoBanner({
  block,
  isLast,
}: {
  block: PromoBannerBlock;
  isLast?: boolean;
}) {
  const { imageUrl, linkUrl, alt } = block.data;
  if (!imageUrl) {
    // 관리자가 아직 이미지 업로드 안 함 → placeholder
    return (
      <Section
        style={{
          marginLeft: "-16px",
          marginRight: "-16px",
          marginTop: "16px",
          marginBottom: isLast ? "16px" : "32px",
          padding: "40px 24px",
          backgroundColor: "#f5f6fa",
          border: "1px dashed #c8cdda",
          textAlign: "center",
        }}
      >
        <Text
          style={{
            margin: 0,
            fontSize: "13px",
            color: "#888888",
            fontStyle: "italic",
          }}
        >
          [홍보 배너 — 편집 패널에서 이미지 업로드 필요]
        </Text>
      </Section>
    );
  }

  const img = (
    <Img
      alt={alt ?? ""}
      src={imageUrl}
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        border: "none",
        outline: "none",
        textDecoration: "none",
      }}
    />
  );

  const inner = linkUrl ? (
    <a
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "block", textDecoration: "none" }}
    >
      {img}
    </a>
  ) : (
    img
  );

  return (
    <div
      style={{
        marginLeft: "-16px",
        marginRight: "-16px",
        marginTop: "16px",
        marginBottom: isLast ? "16px" : "32px",
      }}
    >
      {inner}
    </div>
  );
}

/** Whether a block type is numbered in the section label */
export function isNumberedBlock(type: BlockInstance["type"]): boolean {
  // promo_banner 는 챕터 라벨이 아예 없으므로 넘버링 대상에서도 제외.
  return type !== "opening_lede" && type !== "promo_banner";
}

// ─────────────────────────────────────────────
// BLOCK: special_article — 자유 구조 특별 기사
// ─────────────────────────────────────────────
// items 배열을 순회하며 kind 별로 다른 컴포넌트를 렌더한다. image item 의
// layout 이 "left"/"right" 면 바로 다음 paragraph 와 짝지어 2-col 테이블로
// 렌더 (이메일 호환 wrap). 짝이 안 맞으면 image 단독 풀폭으로 폴백.
function SpecialArticle({
  block,
  index,
  isLast,
}: {
  block: SpecialArticleBlock;
  index: string;
  isLast?: boolean;
}) {
  const data = block.data;
  const items = data.items ?? [];

  // image+paragraph 짝짓기 — left/right wrap 케이스 식별
  const rendered: React.ReactNode[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (
      item.kind === "image" &&
      (item.layout === "left" || item.layout === "right")
    ) {
      const next = items[i + 1];
      if (next?.kind === "paragraph" && item.imageUrl) {
        rendered.push(
          <SpecialArticleWrapPair
            key={i}
            image={item}
            paragraph={next}
            layout={item.layout}
          />
        );
        i++; // skip the paired paragraph
        continue;
      }
      // wrap 의도였지만 다음 item 이 단락이 아니거나 이미지 미업로드 →
      // small-center 폴백 (작게 가운데). 풀폭은 의도와 너무 멀어 피함.
      rendered.push(
        <SpecialArticleImage
          key={i}
          item={item}
          forceLayout="small-center"
        />
      );
      continue;
    }
    rendered.push(<SpecialArticleItemRow key={i} item={item} />);
  }

  return (
    <MajorSection isLast={isLast}>
      <SectionLabel index={index} label={data.englishLabel} emoji="✦" />

      {data.eyebrow && data.eyebrow.trim() !== "" && (
        <Text
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "2.5px",
            color: colors.brandNavy,
            textTransform: "uppercase",
            margin: "0 0 8px 0",
          }}
        >
          {data.eyebrow}
        </Text>
      )}

      {data.title && (
        <Heading
          as="h2"
          style={{
            fontSize: "24px",
            fontWeight: 800,
            color: colors.textHeadline,
            lineHeight: 1.35,
            letterSpacing: "-0.3px",
            margin: "0 0 8px 0",
          }}
        >
          {renderMultiline(data.title)}
        </Heading>
      )}

      {data.subtitle && data.subtitle.trim() !== "" && (
        <Text
          style={{
            fontSize: "15px",
            color: colors.textMuted,
            lineHeight: 1.6,
            fontWeight: 500,
            margin: "0 0 24px 0",
          }}
        >
          {data.subtitle}
        </Text>
      )}

      {/* 본문 — items 자유 순서 */}
      {rendered}

      {data.closingNote && data.closingNote.trim() !== "" && (
        <Text
          style={{
            fontSize: "13px",
            color: colors.textMuted,
            fontStyle: "italic",
            lineHeight: 1.7,
            margin: "20px 0 0 0",
            paddingTop: "16px",
            borderTop: `1px solid ${colors.borderSoft}`,
          }}
        >
          {data.closingNote}
        </Text>
      )}

      {data.sourceUrl && data.sourceUrl.trim() !== "" && (
        <Text
          style={{
            fontSize: "12px",
            color: colors.textSoft,
            margin: "16px 0 0 0",
          }}
        >
          <Link
            href={data.sourceUrl}
            style={{
              color: colors.textSoft,
              textDecoration: "underline",
            }}
          >
            원문 보기 →
          </Link>
        </Text>
      )}
    </MajorSection>
  );
}

/**
 * 단일 ContentItem 렌더러 — kind 별 분기.
 * image 의 left/right 케이스는 상위에서 wrap pair 로 처리하므로 여기서는
 * full / small-center 만 다룬다 (혹시 layout 이 left/right 인데 단독으로
 * 들어와도 small-center 로 안전 폴백).
 */
function SpecialArticleItemRow({ item }: { item: SpecialArticleItem }) {
  switch (item.kind) {
    case "paragraph":
      if (!item.text || item.text.trim() === "") return null;
      return (
        <Text
          style={{
            fontSize: "15px",
            color: colors.textBody,
            lineHeight: 1.85,
            fontWeight: 400,
            margin: "0 0 16px 0",
          }}
          dangerouslySetInnerHTML={{ __html: renderInlineHtml(item.text) }}
        />
      );

    case "heading": {
      const level = item.level ?? 2;
      const fontSize = level === 2 ? "18px" : "15px";
      const marginTop = level === 2 ? "24px" : "18px";
      return (
        <Heading
          as={level === 2 ? "h3" : "h4"}
          style={{
            fontSize,
            fontWeight: 700,
            color: colors.textHeadline,
            lineHeight: 1.4,
            letterSpacing: "-0.2px",
            margin: `${marginTop} 0 10px 0`,
          }}
        >
          {renderMultiline(item.text)}
        </Heading>
      );
    }

    case "quote":
      return (
        <Text
          style={{
            fontSize: "16px",
            fontWeight: 500,
            fontStyle: "italic",
            color: colors.textHeadline,
            lineHeight: 1.6,
            borderLeft: `3px solid ${colors.brandNavy}`,
            paddingLeft: "14px",
            margin: "20px 0 20px 0",
          }}
        >
          {item.text}
          {item.attribution && (
            <span
              style={{
                display: "block",
                fontSize: "12px",
                fontStyle: "normal",
                color: colors.textMuted,
                marginTop: "8px",
                letterSpacing: "0.2px",
              }}
            >
              — {item.attribution}
            </span>
          )}
        </Text>
      );

    case "image":
      return <SpecialArticleImage item={item} />;

    case "divider":
      return (
        <div
          style={{
            textAlign: "center",
            margin: "24px 0",
            fontSize: "12px",
            lineHeight: 1,
            color: colors.accentGold,
            letterSpacing: "8px",
          }}
        >
          ◆ ◆ ◆
        </div>
      );
  }
}

/**
 * 자유 구조 본문에 끼우는 이미지. layout 별 폭/정렬 분기:
 *   - full          : 100% 폭, 카드 패딩만큼 negative margin 으로 풀블리드
 *   - small-center  : 중앙, max 320px
 *   - left/right    : 상위 SpecialArticle 에서 wrap pair 로 처리. 짝 없으면
 *                     small-center 로 폴백 (forceLayout 인자로 강제).
 */
function SpecialArticleImage({
  item,
  forceLayout,
}: {
  item: Extract<SpecialArticleItem, { kind: "image" }>;
  forceLayout?: "full" | "small-center";
}) {
  if (!item.imageUrl) return null;
  const layout =
    forceLayout ??
    (item.layout === "full" || item.layout === "small-center"
      ? item.layout
      : "small-center");

  if (layout === "full") {
    return (
      <div
        style={{
          marginLeft: "-16px",
          marginRight: "-16px",
          marginTop: "20px",
          marginBottom: "20px",
        }}
      >
        <Img
          alt={item.caption ?? ""}
          src={item.imageUrl}
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            border: "none",
            outline: "none",
            textDecoration: "none",
          }}
        />
        {item.caption && (
          <Text
            style={{
              fontSize: "12px",
              color: colors.textMuted,
              fontStyle: "italic",
              textAlign: "center",
              margin: "8px 16px 0 16px",
              lineHeight: 1.5,
            }}
          >
            {item.caption}
          </Text>
        )}
      </div>
    );
  }

  // small-center
  return (
    <div
      style={{
        textAlign: "center",
        margin: "20px 0",
      }}
    >
      <Img
        alt={item.caption ?? ""}
        src={item.imageUrl}
        style={{
          display: "block",
          maxWidth: "320px",
          width: "100%",
          height: "auto",
          margin: "0 auto",
          border: "none",
          outline: "none",
          textDecoration: "none",
          borderRadius: "6px",
        }}
      />
      {item.caption && (
        <Text
          style={{
            fontSize: "12px",
            color: colors.textMuted,
            fontStyle: "italic",
            textAlign: "center",
            margin: "8px 0 0 0",
            lineHeight: 1.5,
          }}
        >
          {item.caption}
        </Text>
      )}
    </div>
  );
}

/**
 * left/right wrap 페어 — 이미지 + 바로 다음 단락을 2-col 테이블로 렌더.
 * 이메일 호환을 위해 float 가 아니라 table 사용. 모바일에서는 표 셀이
 * 자동으로 위/아래 스택되도록 inline-block 폴백을 두지 않고 그냥 td 두 개로
 * 끝낸다 (대부분 모바일 클라가 narrow viewport 에서 stack 으로 자동 변환).
 */
function SpecialArticleWrapPair({
  image,
  paragraph,
  layout,
}: {
  image: Extract<SpecialArticleItem, { kind: "image" }>;
  paragraph: Extract<SpecialArticleItem, { kind: "paragraph" }>;
  layout: "left" | "right";
}) {
  const imgCell = (
    <td
      width="42%"
      valign="top"
      style={{
        verticalAlign: "top",
        paddingRight: layout === "left" ? "16px" : 0,
        paddingLeft: layout === "right" ? "16px" : 0,
      }}
    >
      <Img
        alt={image.caption ?? ""}
        src={image.imageUrl}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          border: "none",
          outline: "none",
          textDecoration: "none",
          borderRadius: "6px",
        }}
      />
      {image.caption && (
        <Text
          style={{
            fontSize: "11px",
            color: colors.textMuted,
            fontStyle: "italic",
            margin: "6px 0 0 0",
            lineHeight: 1.5,
          }}
        >
          {image.caption}
        </Text>
      )}
    </td>
  );

  const textCell = (
    <td valign="top" style={{ verticalAlign: "top" }}>
      <Text
        style={{
          fontSize: "15px",
          color: colors.textBody,
          lineHeight: 1.85,
          fontWeight: 400,
          margin: 0,
        }}
        dangerouslySetInnerHTML={{
          __html: renderInlineHtml(paragraph.text),
        }}
      />
    </td>
  );

  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      width="100%"
      style={{
        borderCollapse: "collapse",
        margin: "16px 0",
      }}
    >
      <tbody>
        <tr>
          {layout === "left" ? imgCell : textCell}
          {layout === "left" ? textCell : imgCell}
        </tr>
      </tbody>
    </table>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
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

  // left / right — magazine-style text wrap using CSS float. Body text
  // flows alongside the image until the image ends, then continues at
  // full width below. The previous 2-column table version left a big
  // empty gap under short images whenever the body was long.
  //
  // Compatibility: Apple Mail / Gmail (web+mobile) / Samsung Mail /
  // Naver all honor `float`. Outlook desktop (Word engine) ignores it
  // → image renders block and text flows below — same as the `full`
  // layout, a graceful fallback. Mobile override: the `.float-image`
  // class in the head stylesheet strips float + forces full width
  // below 480px so phones always see image-on-top stacked.
  const floatImg = (
    <Img
      src={src}
      alt={alt}
      className="float-image"
      style={{
        float: mode,
        width: "45%",
        maxWidth: "280px",
        height: "auto",
        borderRadius: "8px",
        marginRight: mode === "left" ? "18px" : 0,
        marginLeft: mode === "right" ? "18px" : 0,
        marginBottom: "10px",
        display: "block",
      }}
    />
  );
  return (
    <>
      {floatImg}
      {children}
      {/* Clear the float so the next sibling (insight box, source
          link, etc) starts on its own row. `fontSize: 0` keeps the
          clearing div zero-height. */}
      <div style={{ clear: "both", fontSize: 0, lineHeight: 0 }} />
    </>
  );
}

// Re-export the Pill helper for consumers
export { Pill, BlockImage, ImageWithBody };
