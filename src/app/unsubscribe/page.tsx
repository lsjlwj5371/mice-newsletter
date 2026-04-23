import { loadTemplateSettings } from "@/lib/template-settings";
import { UnsubscribeForm } from "./unsubscribe-form";

export const dynamic = "force-dynamic";

/**
 * Generic (token-less) unsubscribe landing page.
 *
 * Used when the newsletter HTML is exported and sent by a third-party
 * (e.g. Naver Cloud) that cannot substitute a per-recipient token into
 * {{UNSUBSCRIBE_HREF}}. The visitor types their email; we look it up
 * in `recipients` and flip the status.
 */
export default async function UnsubscribePage() {
  const template = await loadTemplateSettings();
  const brand = (template.header.wordmark ?? "").trim() || "뉴스레터";
  return <UnsubscribeForm brand={brand} />;
}
