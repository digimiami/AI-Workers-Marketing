import type { SupabaseClient } from "@supabase/supabase-js";

import { buildLandingCustomizeUserPrompt, LANDING_CUSTOMIZE_SYSTEM } from "@/ai/prompts/landing_customize.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";
import { clearCampaignLandingFix } from "@/services/marketing-pipeline/landingCopyGuards";
import { buildLandingVariantBlocks, DEFAULT_LANDING_VISUAL_PRESET } from "@/services/marketing-pipeline/landingVariantBlocks";
import { resolveCampaignBuildFields } from "@/services/workspace/campaignBuildContext";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function inferLandingCustomizeFeatures(instruction: string): string[] {
  const features: string[] = [];
  const t = instruction.toLowerCase();
  if (/\b(form|lead\s*capture|signup|sign\s*up|email\s+field|contact\s+form)\b/i.test(t)) features.push("lead_form");
  if (/\b(picture|photo|image|hero\s*image|gallery)\b/i.test(t)) features.push("images");
  if (/\b(video|youtube|vimeo|embed)\b/i.test(t)) features.push("video");
  if (/\b(track\s*campaign|campaign\s*track|utm|conversion\s*track|track\s*conversions)\b/i.test(t)) features.push("campaign_tracking");
  if (/\b(track\s*email|email\s*track|email\s*opens?|nurture\s*track)\b/i.test(t)) features.push("email_tracking");
  return features;
}

function applyRulePatches(content: Record<string, unknown>, instruction: string): Record<string, unknown> {
  const next = { ...content };
  const features = inferLandingCustomizeFeatures(instruction);
  const tracking = asRecord(next.tracking);
  const media = asRecord(next.media);
  let formFields = Array.isArray(next.formFields)
    ? (next.formFields as unknown[]).filter((x): x is string => typeof x === "string")
    : ["email"];

  if (features.includes("lead_form") && !formFields.includes("email")) formFields = ["email", ...formFields];
  if (/\b(name|full\s*name)\b/i.test(instruction) && !formFields.includes("name")) formFields.push("name");
  if (/\b(phone|call)\b/i.test(instruction) && !formFields.includes("phone")) formFields.push("phone");
  if (/\bcompany\b/i.test(instruction) && !formFields.includes("company")) formFields.push("company");

  if (features.includes("campaign_tracking")) tracking.campaign = true;
  if (features.includes("email_tracking")) tracking.email = true;

  if (features.includes("images") && !media.heroImageUrl && !Array.isArray(media.images)) {
    media.heroImageUrl = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop";
    media.images = [{ url: media.heroImageUrl as string, alt: "Product or service highlight", caption: "" }];
  }

  next.formFields = formFields;
  next.tracking = tracking;
  next.media = media;
  return next;
}

export type CustomizeLandingResult =
  | { ok: true; variantKey: string; previewUrl: string; applied: string[] }
  | { ok: false; status: number; message: string };

export async function customizeLandingPageForCampaign(params: {
  admin: SupabaseClient;
  organizationId: string;
  campaignId: string;
  instruction: string;
  variantKey?: string;
  actorUserId?: string;
}): Promise<CustomizeLandingResult> {
  const instruction = params.instruction.trim();
  if (!instruction) return { ok: false, status: 400, message: "Instruction is required." };

  const fields = await resolveCampaignBuildFields(params.admin, params.organizationId, params.campaignId);
  if (!fields.url || !fields.goal) {
    return { ok: false, status: 400, message: "Campaign build context is incomplete. Run the pipeline or set URL/goal first." };
  }

  const variantKey = params.variantKey ?? "direct_response";
  const { data: row, error } = await params.admin
    .from("landing_page_variants" as never)
    .select("id,content,funnel_step_id,variant_key")
    .eq("organization_id", params.organizationId)
    .eq("campaign_id", params.campaignId)
    .eq("variant_key", variantKey)
    .maybeSingle();
  if (error) return { ok: false, status: 500, message: error.message };
  if (!row) return { ok: false, status: 404, message: `No landing variant "${variantKey}" found. Regenerate landing pages first.` };

  const currentContent = asRecord((row as { content?: unknown }).content);
  const features = inferLandingCustomizeFeatures(instruction);

  const out = await runStrictJsonPrompt({
    system: LANDING_CUSTOMIZE_SYSTEM,
    user: buildLandingCustomizeUserPrompt({
      instruction,
      currentContent,
      url: fields.url,
      goal: fields.goal,
      audience: fields.audience,
      trafficSource: fields.trafficSource,
      requiredFeatures: features,
    }),
    fallbackJsonText: JSON.stringify(currentContent),
    organizationId: params.organizationId,
    userId: params.actorUserId ?? null,
  });

  let parsedPatch: Record<string, unknown> = currentContent;
  if (out.meta.used) {
    try {
      parsedPatch = asRecord(JSON.parse(out.jsonText));
    } catch {
      parsedPatch = currentContent;
    }
  }
  let patched = asRecord({ ...currentContent, ...parsedPatch });
  patched = applyRulePatches({ ...currentContent, ...patched }, instruction);

  const blocks = buildLandingVariantBlocks(patched);
  const now = new Date().toISOString();
  const mergedContent: Record<string, unknown> = {
    ...currentContent,
    ...patched,
    visual_preset: currentContent.visual_preset ?? DEFAULT_LANDING_VISUAL_PRESET,
    blocks,
    customized_at: now,
    customize_instruction: instruction.slice(0, 500),
  };

  const { error: upErr } = await params.admin
    .from("landing_page_variants" as never)
    .update({ content: mergedContent, updated_at: now } as never)
    .eq("organization_id", params.organizationId)
    .eq("campaign_id", params.campaignId)
    .eq("variant_key", variantKey);
  if (upErr) return { ok: false, status: 500, message: upErr.message };

  await clearCampaignLandingFix({
    admin: params.admin,
    organizationId: params.organizationId,
    campaignId: params.campaignId,
  });

  let landingSlug = "landing";
  const funnelStepId = (row as { funnel_step_id?: string | null }).funnel_step_id;
  if (funnelStepId) {
    const { data: step } = await params.admin
      .from("funnel_steps" as never)
      .select("slug")
      .eq("id", funnelStepId)
      .maybeSingle();
    const slug = (step as { slug?: string } | null)?.slug;
    if (slug) landingSlug = String(slug);
  }

  return {
    ok: true,
    variantKey,
    previewUrl: `/f/${params.campaignId}/${encodeURIComponent(landingSlug)}?variant=${encodeURIComponent(variantKey)}`,
    applied: features.length ? features : ["ai_customize"],
  };
}
