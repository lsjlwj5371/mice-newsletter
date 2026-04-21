import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
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
 * PIK newsletter email template (schema_version = 2 — block-based).
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
            padding: spacing.wrapperPadding,
            border: "1px solid #d8dde4",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
        >
          <NewsletterHeaderBlock content={content.header} />
          <ReferralCtaBlock content={content.referralCta} />

          {indexedBlocks.map(({ block, index }) => (
            <BlockRenderer key={block.id} block={block} index={index} />
          ))}

          <NewsletterFooterBlock content={content.footer} appUrl={appUrl} />
        </Container>
      </Body>
    </Html>
  );
}
