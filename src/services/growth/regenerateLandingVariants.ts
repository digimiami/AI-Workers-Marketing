import type { SupabaseClient } from "@supabase/supabase-js";

import { generateLandingVariants } from "@/services/growth/landingVariantsService";
import { scrapeUrlTextOrThrow } from "@/services/web/scrapeUrlText";
import {
  clearCampaignLandingFix,
  markCampaignNeedsLandingFix,
  validateLandingVariantQuality,
  type LandingFixReason,
} from "@/services/marketing-pipeline/landingCopyGuards";

export type RegenerateLandingVariantsInput = {
  organizationId: string;
  campaignId: string;
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
};

export type RegenerateLandingVariantsResult =
  | {
      ok: true;
      variantsWritten: number;
      keys: string[];
      finalUrl: string;
      raw: Record<string, unknown>;
    }
  | {
      ok: false;
      status: number;
      reason: LandingFixReason;
      message: string;
      detail?: string;
      rejections?: Array<{ key: string; reason: string; detail?: string }>;
    };

/**
 * Regenerate landing variants for a campaign with strict quality gating.
 *
 * Pipeline steps:
 *   1. Scrape URL → fail with `scrape_failed` if site is unreachable / too small.
 *   2. Run AI variant generator → fail with `model_unused` if provider returns nothing usable.
 *   3. Validate every variant via `validateLandingVariantQuality` (banned/placeholder/missing).
 *   4. Reject the entire batch if any variant fails — never half-overwrite good copy.
 *   5. Write only on success and clear `needs_generation_fix` flag.
 *
 * On every failure path the campaign is marked `landing_status: needs_generation_fix`
 * with the specific reason so the workspace UI can surface a regenerate action.
 */
export async function regenerateLandingVariantsForCampaign(params: {
  admin: SupabaseClient;
  input: RegenerateLandingVariantsInput;
}): Promise<RegenerateLandingVariantsResult> {
  const { admin, input } = params;
  const { organizationId, campaignId, url, goal, audience, trafficSource } = input;

  let scrapedContent = "";
  let scrapedTitle: string | null = null;
  let finalUrl = url;
  try {
    const scraped = await scrapeUrlTextOrThrow({ url, minChars: 300, timeoutMs: 20000 });
    scrapedContent = scraped.contentText;
    scrapedTitle = scraped.title;
    finalUrl = scraped.finalUrl;
    console.info("[landing] regen-scrape", {
      url,
      finalUrl,
      title: scrapedTitle,
      contentChars: scraped.contentChars,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "scrape_failed";
    console.warn("[landing] regen-scrape-failed", { url, detail });
    await markCampaignNeedsLandingFix({
      admin,
      organizationId,
      campaignId,
      reason: "scrape_failed",
      detail,
    });
    return {
      ok: false,
      status: 422,
      reason: "scrape_failed",
      message:
        "We couldn't read enough content from this URL to generate a real landing page. Try a public marketing URL or rerun once the site is reachable.",
      detail,
    };
  }

  const result = await generateLandingVariants({
    url: finalUrl,
    content: scrapedContent,
    goal,
    audience,
    trafficSource,
    baseLanding: null,
  });

  if (!result.meta.used) {
    console.warn("[landing] regen-model-unused", { url: finalUrl });
    await markCampaignNeedsLandingFix({
      admin,
      organizationId,
      campaignId,
      reason: "model_unused",
      detail: "AI provider returned no usable JSON; landing variants not regenerated.",
    });
    return {
      ok: false,
      status: 503,
      reason: "model_unused",
      message:
        "The AI provider didn't return usable copy for this regeneration. Your existing variants were left untouched.",
    };
  }

  const pack = result.variants;
  const variants = Array.isArray((pack as { variants?: unknown }).variants)
    ? ((pack as { variants: unknown[] }).variants as Record<string, unknown>[])
    : [];

  if (variants.length === 0) {
    console.warn("[landing] regen-empty-variants", { url: finalUrl });
    await markCampaignNeedsLandingFix({
      admin,
      organizationId,
      campaignId,
      reason: "missing_variants",
      detail: "Model response contained no variants array.",
    });
    return {
      ok: false,
      status: 422,
      reason: "missing_variants",
      message: "The AI returned no landing variants. Please regenerate.",
    };
  }

  const now = new Date().toISOString();
  const rejections: Array<{ key: string; reason: string; detail?: string }> = [];
  const prepared: Array<{ key: string; angle: string; content: Record<string, unknown> }> = [];

  for (const v of variants) {
    const key =
      typeof v.variantKey === "string"
        ? v.variantKey
        : typeof (v as { key?: string }).key === "string"
          ? String((v as { key?: string }).key)
          : "";
    if (!key) {
      rejections.push({ key: "(missing)", reason: "missing_fields", detail: "variantKey" });
      continue;
    }
    const angle = typeof v.angle === "string" ? v.angle : key;
    const content: Record<string, unknown> = {
      headline: typeof v.headline === "string" ? v.headline : "",
      subheadline: typeof v.subheadline === "string" ? v.subheadline : "",
      ctaText:
        typeof (v as { ctaText?: unknown }).ctaText === "string"
          ? String((v as { ctaText?: unknown }).ctaText)
          : typeof (v as { cta?: unknown }).cta === "string"
            ? String((v as { cta?: unknown }).cta)
            : "",
      benefits: Array.isArray(v.benefits) ? v.benefits : [],
      steps: Array.isArray(v.steps) ? v.steps : [],
      trustLine: typeof v.trustLine === "string" ? v.trustLine : "",
      finalCTA: (v as { finalCTA?: unknown }).finalCTA ?? {},
      psychologicalTrigger:
        typeof (v as { psychologicalTrigger?: unknown }).psychologicalTrigger === "string"
          ? String((v as { psychologicalTrigger?: unknown }).psychologicalTrigger)
          : "",
      variantLabel:
        typeof (v as { variantLabel?: unknown }).variantLabel === "string"
          ? String((v as { variantLabel?: unknown }).variantLabel)
          : "",
      regenerated_at: now,
    };
    const verdict = validateLandingVariantQuality(content, {
      campaignUrl: finalUrl,
      scrapedTitle: scrapedTitle,
      scrapedContentPrefix: scrapedContent,
    });
    if (!verdict.ok) {
      rejections.push({ key, reason: verdict.reason, detail: verdict.detail });
      continue;
    }
    prepared.push({ key, angle, content });
  }

  console.info("[landing] regen-validation", {
    url: finalUrl,
    accepted: prepared.length,
    rejected: rejections.length,
    rejections,
  });

  if (rejections.length > 0 || prepared.length === 0) {
    const first = rejections[0];
    const reason: LandingFixReason =
      first?.reason === "banned_phrase"
        ? "banned_phrase"
        : first?.reason === "placeholder"
          ? "placeholder"
          : first?.reason === "not_anchored"
            ? "not_anchored"
            : "invalid_shape";
    await markCampaignNeedsLandingFix({
      admin,
      organizationId,
      campaignId,
      reason,
      detail: `Rejected ${rejections.length}/${variants.length} variants: ${first?.detail ?? ""}`,
    });
    return {
      ok: false,
      status: 422,
      reason,
      rejections,
      message:
        first?.reason === "banned_phrase"
          ? `Generic phrase "${first.detail}" detected — refusing to publish placeholder copy.`
          : first?.reason === "placeholder"
            ? `Placeholder text "${first.detail}" detected — refusing to publish scaffolding copy.`
            : first?.reason === "not_anchored"
              ? `Copy is not anchored to the client URL/page: ${first.detail ?? "fix headline and benefits"}.`
              : "AI output failed quality gates — landing variants were not updated.",
    };
  }

  for (const item of prepared) {
    const { error } = await admin
      .from("landing_page_variants" as never)
      .update({ angle: item.angle, content: item.content as never, updated_at: now, status: "draft" } as never)
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .eq("variant_key", item.key);
    if (error) {
      console.error("[landing] regen-write-failed", { variantKey: item.key, error: error.message });
      return {
        ok: false,
        status: 500,
        reason: "invalid_shape",
        message: error.message,
      };
    }
  }

  await clearCampaignLandingFix({ admin, organizationId, campaignId });

  console.info("[landing] regen-success", {
    url: finalUrl,
    variantsWritten: prepared.length,
    keys: prepared.map((p) => p.key),
  });

  return {
    ok: true,
    variantsWritten: prepared.length,
    keys: prepared.map((p) => p.key),
    finalUrl,
    raw: pack,
  };
}
