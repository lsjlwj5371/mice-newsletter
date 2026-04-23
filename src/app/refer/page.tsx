import { loadTemplateSettings } from "@/lib/template-settings";
import { ReferForm } from "./refer-form";

export const dynamic = "force-dynamic";

export default async function ReferPage() {
  const template = await loadTemplateSettings();
  const brand = (template.header.wordmark ?? "").trim() || "뉴스레터";
  const tagline = (template.header.tagline ?? "").trim();
  return <ReferForm brand={brand} tagline={tagline} />;
}
