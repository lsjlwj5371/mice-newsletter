import * as React from "react";
import { render } from "@react-email/render";
import { requireAdmin } from "@/lib/auth-helpers";
import Newsletter from "@/emails/Newsletter";
import { sampleNewsletter } from "@/lib/sample-newsletter";
import { loadTemplateSettings } from "@/lib/template-settings";
import { PreviewClient } from "./preview-client";

export const dynamic = "force-dynamic";

/**
 * Design preview using the sample content. Fixed sections (header /
 * referralCta / footer) are OVERRIDDEN at render time with the current
 * template_settings row, so saving the /settings template form shows up
 * here immediately — this page is the fastest way for admins to see a
 * template change before firing off a real draft.
 *
 * Per-issue fields (issueMeta, concrete clickable tokens) are kept from
 * the sample so the preview remains useful as a full page mockup.
 */
export default async function PreviewNewsletterPage() {
  await requireAdmin();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const template = await loadTemplateSettings();

  const content = {
    ...sampleNewsletter,
    header: {
      ...template.header,
      issueMeta: sampleNewsletter.header.issueMeta,
    },
    referralCta: {
      ...template.referralCta,
      buttonHref:
        template.referralCta.buttonHref &&
        !template.referralCta.buttonHref.includes("{{")
          ? template.referralCta.buttonHref
          : sampleNewsletter.referralCta.buttonHref,
    },
    footer: {
      ...template.footer,
      unsubscribeHref:
        template.footer.unsubscribeHref &&
        !template.footer.unsubscribeHref.includes("{{")
          ? template.footer.unsubscribeHref
          : sampleNewsletter.footer.unsubscribeHref,
    },
  };

  const html = await render(
    <Newsletter content={content} appUrl={appUrl} />,
    { pretty: false }
  );

  return <PreviewClient html={html} subject={sampleNewsletter.subject} />;
}
