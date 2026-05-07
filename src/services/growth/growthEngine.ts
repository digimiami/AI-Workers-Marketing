import crypto from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MarketingPipelineFunnelStyle } from "@/services/marketing-pipeline/types";
import { runMarketingPipeline } from "@/services/marketing-pipeline/runMarketingPipeline";
import { generatePaidAdsDraftPack, persistDraftIntoDb } from "@/services/ads/adsDraftService";
import { resolveLandingDestination } from "@/services/ads/adsEngine";

import { analyzeUrlResearch } from "@/services/growth/urlResearchService";
import { classifyBusiness } from "@/services/growth/businessClassifierService";
import { buildFunnelBlueprint } from "@/services/growth/funnelBuilderService";
import { generateLandingVariants } from "@/services/growth/landingVariantsService";
import { routeTrafficToVariant, variantLetterToDbKey } from "@/services/growth/trafficRouterService";
import { ensureDefaultLeadPipelineStages } from "@/services/growth/leadPipelineService";
import { visualizeFunnelPerformance } from "@/services/growth/funnelVisualizerService";
import { runOptimizationEngine } from "@/services/growth/optimizationEngineService";
import { generateEmailSequenceNurture } from "@/services/growth/emailSequenceService";

export type RunAiGrowthEngineInput = {
  orgId: string;
  userId: string;
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  budget: number;
  provider: "openclaw" | "internal_llm" | "hybrid";
  adsProviderMode: "stub" | "live";
  approvalMode: "required" | "auto_draft";
  mode?: "affiliate" | "client";
};

export type RunAiGrowthEngineResult = {
  research: Record<string, unknown>;
  classification: Record<string, unknown>;
  funnel: Record<string, unknown>;
  landingVariants: Record<string, unknown>;
  selectedVariant: { letter: string; dbKey: "direct_response" | "premium_trust" | "speed_convenience"; router: Record<string, unknown> };
  adCampaigns: Array<Record<string, unknown>>;
  ads: Array<Record<string, unknown>>;
  emailSequence: Record<string, unknown>;
  leadPipeline: { stagesEnsured: boolean };
  tracking: { cid: string; baseUrl: string; notes: string };
  approvals: Array<{ id: string; approval_type?: string }>;
  optimizationBaseline: Record<string, unknown>;
  funnelVisualization: Record<string, unknown>;
  pipeline: Awaited<ReturnType<typeof runMarketingPipeline>>;
};

function mapBestFunnelTypeToFunnelStyle(ft: unknown): MarketingPipelineFunnelStyle | undefined {
  const s = typeof ft === "string" ? ft : "";
  const map: Record<string, MarketingPipelineFunnelStyle> = {
    affiliate_bridge: "bridge_lead",
    webinar: "webinar",
    product_offer: "product_offer",
    application: "application",
    consultation: "clickfunnels_lead",
    demo_booking: "application",
    free_trial: "product_offer",
    quiz: "clickfunnels_lead",
    lead_magnet: "clickfunnels_lead",
    direct_response: "clickfunnels_lead",
  };
  return map[s];
}

function inferAdPlatforms(trafficSource: string): Array<"google" | "meta"> {
  const t = trafficSource.toLowerCase();
  const out: Array<"google" | "meta"> = [];
  if (t.includes("google") || t.includes("search")) out.push("google");
  if (t.includes("meta") || t.includes("facebook") || t.includes("instagram")) out.push("meta");
  if (!out.length) out.push("google", "meta");
  return Array.from(new Set(out));
}

export async function runAiGrowthEngine(params: {
  supabase: SupabaseClient;
  actorUserId: string;
  input: RunAiGrowthEngineInput;
}): Promise<RunAiGrowthEngineResult> {
  const admin = createSupabaseAdminClient();
  const input = params.input;
  const cid = crypto.randomUUID();
  const baseUrl = (env.server.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const { data: orgRow } = await admin.from("organizations" as never).select("name").eq("id", input.orgId).maybeSingle();
  const orgName = (orgRow as { name?: string } | null)?.name ?? null;

  await ensureDefaultLeadPipelineStages(admin, input.orgId);

  const research = await analyzeUrlResearch({
    url: input.url,
    goal: input.goal,
    audience: input.audience,
    trafficSource: input.trafficSource,
    orgName,
  });

  const classification = await classifyBusiness({
    url: input.url,
    goal: input.goal,
    audience: input.audience,
    trafficSource: input.trafficSource,
    urlResearch: research,
  });

  const funnel = await buildFunnelBlueprint({
    url: input.url,
    goal: input.goal,
    audience: input.audience,
    trafficSource: input.trafficSource,
    urlResearch: research,
    classification,
  });

  const landingVariants = await generateLandingVariants({
    url: input.url,
    goal: input.goal,
    audience: input.audience,
    trafficSource: input.trafficSource,
    baseLanding: null,
  });

  const router = await routeTrafficToVariant({
    trafficSource: input.trafficSource,
    device: "unknown",
    intentLevel: "unknown",
    location: null,
    userBehavior: null,
    variantPerformance: null,
  });

  const letter = typeof router.selectedVariant === "string" ? router.selectedVariant : "A";
  const dbKey = variantLetterToDbKey(letter);

  const emailSequence = await generateEmailSequenceNurture({
    url: input.url,
    goal: input.goal,
    audience: input.audience,
    trafficSource: input.trafficSource,
  });

  const funnelStepsForViz = Array.isArray(funnel.steps)
    ? (funnel.steps as unknown[]).map((s) => {
        const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
        return {
          stepName: String(o.name ?? o.stepName ?? "Step"),
          visitors: 0,
          conversions: 0,
        };
      })
    : [];

  const funnelVisualization = await visualizeFunnelPerformance({
    campaignName: `${input.goal} · ${input.trafficSource}`.slice(0, 80),
    steps: funnelStepsForViz,
  });

  const optimizationBaseline = await runOptimizationEngine({
    campaignName: String(funnel.funnelName ?? input.goal).slice(0, 120),
    autopilotEnabled: false,
    metrics: { phase: "baseline", daily_budget: input.budget, traffic_source: input.trafficSource },
    funnelSummary: funnelVisualization,
  });

  const funnelStyle = mapBestFunnelTypeToFunnelStyle(classification.bestFunnelType);

  const pipeline = await runMarketingPipeline({
    supabase: params.supabase,
    actorUserId: params.actorUserId,
    input: {
      organizationMode: "existing",
      organizationId: input.orgId,
      url: input.url,
      mode: input.mode ?? "client",
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      funnelStyle,
      notes: `Growth engine · budget ${input.budget}/day · ads ${input.adsProviderMode}`,
      provider: input.provider,
      approvalMode: input.approvalMode,
    },
  });

  const campaignId = pipeline.campaignId;
  const approvals = pipeline.approvalItems ?? [];

  const adCampaigns: Array<Record<string, unknown>> = [];
  const ads: Array<Record<string, unknown>> = [];

  if (campaignId) {
    const { data: prevCamp } = await admin
      .from("campaigns" as never)
      .select("metadata,name")
      .eq("organization_id", input.orgId)
      .eq("id", campaignId)
      .maybeSingle();
    const prevMeta = asMetadataRecord((prevCamp as { metadata?: unknown } | null)?.metadata);
    const campaignName = String((prevCamp as { name?: string } | null)?.name ?? input.goal);

    const growthPatch = mergeJsonbRecords(prevMeta, {
      url: input.url,
      goal: input.goal,
      audience: input.audience,
      traffic_source: input.trafficSource,
      growth_engine: {
        version: 1,
        url_research: research,
        business_classification: classification,
        funnel_blueprint: funnel,
        landing_variants_plan: landingVariants,
        traffic_router_default: router,
        selected_variant_key: dbKey,
        email_sequence_plan: emailSequence,
        funnel_visualization: funnelVisualization,
        optimization_baseline: optimizationBaseline,
        daily_budget: input.budget,
        ads_provider_mode_requested: input.adsProviderMode,
        tracking: {
          cid,
          utm_template: "utm_source,utm_campaign,utm_content,cid,ad_id,variant_id",
        },
        traffic_routing: {
          mode: "ai_smart_routing",
          rule: typeof router.routingRule === "string" ? router.routingRule : "even_split_default",
          notes: "Switch to even split in UI if you want deterministic A/B/C volume.",
        },
      },
    });

    await admin
      .from("campaigns" as never)
      .update({ metadata: growthPatch, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", input.orgId)
      .eq("id", campaignId);

    await admin
      .from("landing_page_variants" as never)
      .update({ selected: false, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", input.orgId)
      .eq("campaign_id", campaignId);

    await admin
      .from("landing_page_variants" as never)
      .update({ selected: true, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", input.orgId)
      .eq("campaign_id", campaignId)
      .eq("variant_key", dbKey);

    const dest = await resolveLandingDestination({
      admin,
      organizationId: input.orgId,
      campaignId,
      landingPageVariantId: null,
    });

    for (const platform of inferAdPlatforms(input.trafficSource)) {
      const { count, error: cErr } = await admin
        .from("ad_campaigns" as never)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.orgId)
        .eq("campaign_id", campaignId)
        .eq("platform", platform);
      if (cErr) continue;
      if ((count ?? 0) > 0) continue;

      const pack = await generatePaidAdsDraftPack({
        organizationId: input.orgId,
        campaignId,
        platform,
        dailyBudget: Math.max(1, Math.round(input.budget)),
        objective: "leads",
        destinationPath: dest.destinationPath,
        tracking: { cid, campaignName, variantId: dest.variantId },
        context: {
          url: input.url,
          goal: input.goal,
          audience: input.audience,
          trafficSource: input.trafficSource,
        },
      });

      const persisted = await persistDraftIntoDb({
        organizationId: input.orgId,
        campaignId,
        platform,
        dailyBudget: Math.max(1, Math.round(input.budget)),
        objective: "leads",
        destinationUrl: pack.destinationUrl,
        destinationPath: dest.destinationPath,
        draftName: `${campaignName} · ${platform} · growth`,
        platformDraft: pack.platformDraft,
        creativeJson: pack.creativeJson,
      });

      adCampaigns.push({
        id: persisted.adCampaignId,
        platform,
        destinationUrl: pack.destinationUrl,
        adSetIds: persisted.adSetIds,
        adIds: persisted.adIds,
        simulated: (env.server.ADS_PROVIDER_MODE ?? "stub").toLowerCase() !== "live",
      });

      if (persisted.adIds.length) {
        const { data: adRows } = await admin
          .from("ads" as never)
          .select("id,headline,primary_text,destination_url,status")
          .eq("organization_id", input.orgId)
          .eq("ad_campaign_id", persisted.adCampaignId)
          .limit(50);
        for (const row of (adRows ?? []) as any[]) ads.push(row as Record<string, unknown>);
      }
    }
  }

  return {
    research,
    classification,
    funnel,
    landingVariants,
    selectedVariant: { letter, dbKey, router },
    adCampaigns,
    ads,
    emailSequence,
    leadPipeline: { stagesEnsured: true },
    tracking: {
      cid,
      baseUrl,
      notes: "Append utm_* and cid/ad_id/variant_id on all paid and landing links at launch time.",
    },
    approvals,
    optimizationBaseline,
    funnelVisualization,
    pipeline,
  };
}
