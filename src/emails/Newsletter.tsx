import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Preview,
  Font,
} from "@react-email/components";
import { colors, typography, spacing } from "./tokens";
import {
  NewsletterHeaderBlock,
  ReferralCtaBlock,
  NewsletterFooterBlock,
  BlockRenderer,
  isNumberedBlock,
} from "./components/blocks";
import type { NewsletterContent } from "@/types/newsletter";

interface Props {
  content: NewsletterContent;
  /** Absolute base URL for assets (logo, tracking pixel, links) */
  appUrl: string;
}

/**
 * MICE人sight newsletter email template (schema_version = 2 — block-based).
 *
 * Structure:
 *   - Header (fixed)
 *   - Referral CTA (fixed)
 *   - [blocks ordered by admin, numbered sequentially]
 *   - Footer (fixed)
 *
 * Block types are dispatched through BlockRenderer in components/blocks.tsx.
 */
export default function Newsletter({ content, appUrl }: Props) {
  // Auto-number blocks that opt into numbering.
  // `opening_lede` is unnumbered; all other blocks get sequential indices
  // starting from 01 in their own order.
  let cursor = 1;
  const indexedBlocks = content.blocks.map((block) => {
    if (!isNumberedBlock(block.type)) {
      return { block, index: "" };
    }
    const idx = block.indexLabel ?? String(cursor).padStart(2, "0");
    cursor += 1;
    return { block, index: idx };
  });

  return (
    <Html lang="ko">
      <Head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <Font
          fontFamily="Pretendard"
          fallbackFontFamily={["Arial", "sans-serif"]}
          webFont={{
            url: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/woff2/Pretendard-Regular.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Pretendard"
          fallbackFontFamily={["Arial", "sans-serif"]}
          webFont={{
            url: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/woff2/Pretendard-Bold.woff2",
            format: "woff2",
          }}
          fontWeight={700}
          fontStyle="normal"
        />
        <Font
          fontFamily="Pretendard"
          fallbackFontFamily={["Arial", "sans-serif"]}
          webFont={{
            url: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/woff2/Pretendard-Black.woff2",
            format: "woff2",
          }}
          fontWeight={900}
          fontStyle="normal"
        />
        {/* Mobile overrides. iOS Mail / Apple Mail / Gmail mobile apps
            all support @media in <style>. Outlook desktop ignores —
            which is fine, desktop is where the 2-column layouts shine. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
@media (max-width: 480px) {
  /* Image + body row in ImageWithBody left/right layouts: stack.
     (Legacy 2-col variant — kept for any older renderings.) */
  .stack-on-mobile > tbody > tr > td {
    display: block !important;
    width: 100% !important;
    padding: 0 !important;
  }
  .stack-on-mobile .mobile-img {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 0 14px 0 !important;
  }
  /* Float-based left/right wrap: drop the float and force full width
     so on mobile the image sits on top with the body below it — same
     pattern as "full" layout. */
  .float-image {
    float: none !important;
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 0 14px 0 !important;
  }

  /* Header row: brand block + issue meta badge → stack. */
  .header-row > tbody > tr > td {
    display: block !important;
    width: 100% !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    text-align: left !important;
  }
  .header-meta-col {
    margin-top: 14px !important;
    text-align: left !important;
  }
  /* Shrink tagline + description so they fit on a single line at
     ~390px viewports. Combined with white-space:nowrap on the
     elements themselves, this keeps the masthead on one line each. */
  .header-tagline {
    font-size: 13px !important;
    margin-left: 10px !important;
  }
  .header-description {
    font-size: 13px !important;
  }
  /* Issue badge: header-meta-col is now left-aligned, so align the
     badge's internal text to the left too — otherwise VOL 001 and the
     Issue row right-hug a 110px min-width box, which looks off. */
  .issue-meta-badge {
    text-align: left !important;
    min-width: 0 !important;
  }

  /* MICE Insight full-bleed hero — mobile typography tightening.
     Image shows at natural aspect (no cropping regardless of source);
     caption band just needs smaller type to feel phone-native. */
  .hero-caption {
    padding: 18px 18px 20px 18px !important;
  }
  .hero-chip {
    font-size: 10px !important;
    padding: 3px 8px !important;
    margin-bottom: 8px !important;
    letter-spacing: 1px !important;
  }
  .hero-title {
    font-size: 18px !important;
    line-height: 1.3 !important;
    margin-top: 4px !important;
    letter-spacing: -0.2px !important;
  }
  .hero-meta {
    font-size: 12px !important;
    margin-top: 8px !important;
    line-height: 1.4 !important;
  }

  /* Referral CTA row: message + button → stack. */
  .cta-row > tbody > tr > td {
    display: block !important;
    width: 100% !important;
    text-align: left !important;
  }
  .cta-button-col {
    margin-top: 16px !important;
    text-align: left !important;
  }
}
            `,
          }}
        />
      </Head>
      <Preview>{content.subject}</Preview>
      {/* Outer Body: soft neutral canvas behind the newsletter card so
          the inner white container reads as a distinct sheet even in
          mail clients that default to a white background. */}
      <Body
        style={{
          backgroundColor: "#eceff3",
          margin: 0,
          padding: "24px 12px",
          fontFamily: typography.fontFamily,
        }}
      >
        {/* Inner container: the newsletter "card". Subtle border +
            rounded corners + soft shadow give it a clear edge on both
            light (#ffffff) and tinted client backgrounds. */}
        <Container
          style={{
            maxWidth: spacing.containerMaxWidth,
            margin: "0 auto",
            backgroundColor: colors.bgWhite,
            border: "1px solid #d8dde4",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
          }}
        >
          {/* Brand accent bar: 5px navy band at the card's top edge.
              Pure solid color so every mail client renders it — no VML
              or CSS gradients needed. Fills the card width via a full
              table row; the Container's overflow:hidden + rounded
              corners clip it to the card's rounded top. */}
          <Section
            style={{
              backgroundColor: colors.brandNavy,
              height: "5px",
              lineHeight: "5px",
              fontSize: "0",
              margin: 0,
              padding: 0,
            }}
          >
            &nbsp;
          </Section>

          <div style={{ padding: spacing.wrapperPadding }}>
            <NewsletterHeaderBlock content={content.header} />

            {indexedBlocks.map(({ block, index }, i) => (
              <BlockRenderer
                key={block.id}
                block={block}
                index={index}
                isLast={i === indexedBlocks.length - 1}
              />
            ))}

            <ReferralCtaBlock content={content.referralCta} />
            <NewsletterFooterBlock content={content.footer} appUrl={appUrl} />
          </div>
        </Container>
      </Body>
    </Html>
  );
}
