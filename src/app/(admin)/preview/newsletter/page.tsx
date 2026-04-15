import * as React from "react";
import { render } from "@react-email/render";
import { requireAdmin } from "@/lib/auth-helpers";
import Newsletter from "@/emails/Newsletter";
import { sampleNewsletter } from "@/lib/sample-newsletter";
import { PreviewClient } from "./preview-client";

export const dynamic = "force-dynamic";

/**
 * Phase 4.1 — design preview using the sample content.
 * Phase 4.2 will replace `sampleNewsletter` with a real DB-backed
 * newsletter draft loaded by id.
 */
export default async function PreviewNewsletterPage() {
  await requireAdmin();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const html = await render(
    <Newsletter content={sampleNewsletter} appUrl={appUrl} />,
    { pretty: false }
  );

  return <PreviewClient html={html} subject={sampleNewsletter.subject} />;
}
