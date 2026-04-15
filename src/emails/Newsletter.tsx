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
  SpeakHeader,
  ReferralCtaTop,
  OpeningHook,
  NumberOfMonthSection,
  BriefingMajorSection,
  MiceInOutTwoColumn,
  TechSignalDarkSection,
  TheoryToFieldSection,
  NowMiceSection,
  GroundkStoryMajorSection,
  NewsletterFooter,
} from "./components/sections";
import type { NewsletterContent } from "@/types/newsletter";

interface Props {
  content: NewsletterContent;
  /** Absolute base URL for assets (logo, tracking pixel, links) */
  appUrl: string;
}

/**
 * SPEAK newsletter email template — 11 sections in fixed order:
 *
 *  1. Header (SPEAK wordmark)
 *  2. Referral CTA (compact horizontal)
 *  3. Opening Hook (gold left border)
 *  4. 01 / Number of the Month
 *  5. 02 / News Briefing
 *  6. 03 / MICE IN & OUT (2-column: IN / OUT)
 *  7. 04 / TECH SIGNAL (dark inverted)
 *  8. 05 / From Theory to Field (long-form story)
 *  9. 06 / 지금 MICE는 (opinion + pull quote)
 * 10. 07 / GroundK Story (Field Briefing dark + Project Sketch light)
 * 11. Footer (logo + links + unsubscribe)
 */
export default function Newsletter({ content, appUrl }: Props) {
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
      <Body
        style={{
          backgroundColor: colors.bgWhite,
          margin: 0,
          padding: 0,
          fontFamily: typography.fontFamily,
        }}
      >
        <Container
          style={{
            maxWidth: spacing.containerMaxWidth,
            margin: "0 auto",
            backgroundColor: colors.bgWhite,
            padding: spacing.wrapperPadding,
          }}
        >
          {/* 1. Header — SPEAK */}
          <SpeakHeader content={content.header} />

          {/* 2. Referral CTA */}
          <ReferralCtaTop content={content.referralCta} />

          {/* 3. Opening Hook */}
          <OpeningHook content={content.openingHook} />

          {/* 4. 01 — Number of the Month */}
          <NumberOfMonthSection content={content.numberOfMonth} index="01" />

          {/* 5. 02 — News Briefing */}
          <BriefingMajorSection content={content.newsBriefing} index="02" />

          {/* 6. 03 — MICE IN & OUT */}
          <MiceInOutTwoColumn content={content.miceInOut} index="03" />

          {/* 7. 04 — TECH SIGNAL (dark) */}
          <TechSignalDarkSection content={content.techSignal} index="04" />

          {/* 8. 05 — From Theory to Field */}
          <TheoryToFieldSection content={content.theoryToField} index="05" />

          {/* 9. 06 — 지금 MICE는 */}
          <NowMiceSection content={content.nowMice} index="06" />

          {/* 10. 07 — GroundK Story */}
          <GroundkStoryMajorSection content={content.groundkStory} index="07" />

          {/* 11. Footer */}
          <NewsletterFooter content={content.footer} appUrl={appUrl} />
        </Container>
      </Body>
    </Html>
  );
}
