import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildGoogleAdsCampaignDraftUserPrompt, GOOGLE_ADS_GENERATOR_SYSTEM } from "@/ai/prompts/google_ads_generator.prompt";
import { buildMetaCampaignDraftUserPrompt, META_ADS_GENERATOR_SYSTEM } from "@/ai/prompts/meta_ads_generator.prompt";
import { buildAdCreativeGeneratorUserPrompt, AD_CREATIVE_GENERATOR_SYSTEM } from "@/ai/prompts/ad_creative_generator.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";
import { buildCampaignSlug, buildTrackedLandingUrl } from "@/services/ads/adsTrackingService";

function nowIso() {
  return new Date().toISOString();
}

function safeParseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function generatePaidAdsDraftPack(params: {
  organizationId: string;
  campaignId: string;
  platform: "google" | "meta";
  dailyBudget: number;
  objective: string;
  destinationPath: string;
  tracking: { cid: string; campaignName: string; variantId?: string | null };
  context: { url: string; goal: string; audience: string; trafficSource: string };
}) {
  const campaignSlug = buildCampaignSlug(params.tracking.campaignName || params.campaignId);
  const destinationUrl = buildTrackedLandingUrl({
    destinationPathOrUrl: params.destinationPath,
    platform: params.platform,
    ids: { cid: params.tracking.cid, campaignSlug, variantId: params.tracking.variantId ?? null },
    utmContent: "draft",
  });

  const creativeUser = buildAdCreativeGeneratorUserPrompt({
    ...params.context,
    platform: params.platform === "google" ? "google" : "meta",
    landingSummary: { destinationUrl },
  });
  const creative = await runStrictJsonPrompt({
    system: AD_CREATIVE_GENERATOR_SYSTEM,
    user: creativeUser,
    fallbackJsonText: JSON.stringify({
      hooks: Array.from({ length: 10 }).map((_, i) => `Hook ${i + 1}: ${params.context.goal}`),
      headlines: Array.from({ length: 10 }).map((_, i) => `Headline ${i + 1}: ${params.context.goal}`),
      primaryTexts: Array.from({ length: 10 }).map((_, i) => `Primary ${i + 1}: For ${params.context.audience}`),
      descriptions: Array.from({ length: 10 }).map((_, i) => `Desc ${i + 1}`),
      ctas: Array.from({ length: 10 }).map((_, i) => (i % 2 === 0 ? "Learn more" : "Get started")),
      creativeConcepts: Array.from({ length: 5 }).map((_, i) => ({
        conceptName: `Concept ${i + 1}`,
        visualIdea: "Clean product UI + bold headline overlay",
        hook: `Hook ${i + 1}`,
        script: `Script ${i + 1}: problem → proof → CTA`,
        platform: params.platform,
      })),
      videoScripts: Array.from({ length: 5 }).map((_, i) => `Video ${i + 1}: 15s hook + demo + CTA`),
    }),
  });

  const creativeJson = safeParseJson(creative.jsonText);

  if (params.platform === "google") {
    const user = buildGoogleAdsCampaignDraftUserPrompt({
      ...params.context,
      dailyBudget: params.dailyBudget,
      finalUrl: destinationUrl,
      conversionGoal: params.objective,
    });
    const draft = await runStrictJsonPrompt({
      system: GOOGLE_ADS_GENERATOR_SYSTEM,
      user,
      fallbackJsonText: JSON.stringify({
        campaignName: `${campaignSlug}-search`,
        objective: params.objective,
        keywords: [`${params.context.goal}`.slice(0, 40), `${params.context.audience}`.slice(0, 40)],
        negativeKeywords: ["free download crack", "jobs", "careers"],
        adGroups: [
          {
            name: "High intent",
            keywords: [`buy ${params.context.goal}`.slice(0, 40)],
            headlines: ["Fast setup today", "Get qualified leads", "Book a short call"],
            descriptions: ["Clear next steps. Built for busy teams.", "See pricing and timelines in minutes."],
            finalUrl: destinationUrl,
          },
        ],
        dailyBudgetSuggestion: params.dailyBudget,
        conversionGoal: params.objective,
        trackingParameters: {
          utm_source: "google",
          utm_campaign: campaignSlug,
          utm_content: "adgroup",
          cid: params.tracking.cid,
          ad_id: "",
          variant_id: params.tracking.variantId ?? "",
        },
      }),
    });
    return { destinationUrl, creativeJson, platformDraft: safeParseJson(draft.jsonText), meta: { creative: creative.meta, draft: draft.meta } };
  }

  const user = buildMetaCampaignDraftUserPrompt({
    ...params.context,
    dailyBudget: params.dailyBudget,
    destinationUrl,
  });
  const draft = await runStrictJsonPrompt({
    system: META_ADS_GENERATOR_SYSTEM,
    user,
    fallbackJsonText: JSON.stringify({
      campaignName: `${campaignSlug}-meta`,
      objective: params.objective,
      audienceSuggestions: {
        cold: {
          summary: `${params.context.audience}`.slice(0, 120),
          interests: ["Category intent aligned to goal", "Problem-aware readers"],
          exclusions: ["Existing customers (if list available)"],
        },
        retargeting: {
          summary: "Visitors who engaged but did not convert",
          signals: ["Landing page viewers (7d)", "Lead form starters (14d)"],
        },
      },
      adSets: [
        {
          name: "Cold · prospecting",
          budget: Math.max(1, Math.round(params.dailyBudget * 0.65)),
          audience: {
            summary: "Cold interest targeting derived from URL + goal",
            ageRange: "25-54",
            geo: "US/CA/UK (adjust to business)",
          },
          placements: ["facebook_feed", "instagram_feed"],
          ads: Array.from({ length: 3 }).map((_, i) => ({
            headline: `Headline ${i + 1}`,
            primaryText: `For ${params.context.audience}: ${params.context.goal}`,
            description: "Fast next steps. Clear value.",
            cta: i === 0 ? "Learn more" : "Sign up",
            creativeConcept: `Concept ${i + 1}`,
            destinationUrl,
          })),
        },
        {
          name: "Warm · retargeting",
          budget: Math.max(1, Math.round(params.dailyBudget * 0.35)),
          audience: {
            summary: "Retarget engaged visitors / leads",
            ageRange: "25-54",
            geo: "Same as cold (tighten after learning)",
          },
          placements: ["facebook_feed", "instagram_stories"],
          ads: Array.from({ length: 3 }).map((_, i) => ({
            headline: `Reminder ${i + 1}`,
            primaryText: `Still exploring ${params.context.goal}?`,
            description: "See the fastest path to results.",
            cta: "Get started",
            creativeConcept: `Retarget ${i + 1}`,
            destinationUrl,
          })),
        },
      ],
    }),
  });

  return { destinationUrl, creativeJson, platformDraft: safeParseJson(draft.jsonText), meta: { creative: creative.meta, draft: draft.meta } };
}

export async function persistDraftIntoDb(params: {
  organizationId: string;
  campaignId: string;
  platform: "google" | "meta";
  dailyBudget: number;
  objective: string;
  destinationUrl: string;
  destinationPath: string;
  draftName: string;
  platformDraft: Record<string, unknown>;
  creativeJson: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();

  const { data: campRow, error: campErr } = await admin
    .from("ad_campaigns" as never)
    .insert({
      organization_id: params.organizationId,
      campaign_id: params.campaignId,
      platform: params.platform,
      name: params.draftName,
      objective: params.objective,
      status: "draft",
      daily_budget: params.dailyBudget,
      destination_url: params.destinationUrl,
      metadata: { draft: params.platformDraft, creative_pack: params.creativeJson, destination_path: params.destinationPath },
      updated_at: nowIso(),
    } as never)
    .select("id")
    .single();
  if (campErr || !campRow) throw new Error(campErr?.message ?? "Failed to insert ad_campaign");

  const adCampaignId = String((campRow as any).id);

  const adSets = Array.isArray(params.platformDraft.adSets)
    ? (params.platformDraft.adSets as unknown[])
    : Array.isArray((params.platformDraft as any).ad_groups)
      ? ((params.platformDraft as any).ad_groups as unknown[])
      : [];

  const insertedSets: string[] = [];
  for (const s of adSets.slice(0, 6)) {
    const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const { data: setRow, error: setErr } = await admin
      .from("ad_sets" as never)
      .insert({
        organization_id: params.organizationId,
        ad_campaign_id: adCampaignId,
        name: String(o.name ?? "Ad set"),
        budget: typeof o.budget === "number" ? o.budget : typeof o.daily_budget === "number" ? (o.daily_budget as number) : null,
        audience: { raw: o.audience ?? o.targeting ?? {} },
        status: "draft",
        metadata: { placements: o.placements ?? [] },
        updated_at: nowIso(),
      } as never)
      .select("id")
      .single();
    if (!setErr && setRow) insertedSets.push(String((setRow as any).id));
  }

  // Ads: prefer nested ads in draft; otherwise synthesize minimal rows from creative pack.
  const insertedAds: string[] = [];

  const insertAd = async (setId: string | null, ad: Record<string, unknown>) => {
    const { data: adRow, error: adErr } = await admin
      .from("ads" as never)
      .insert({
        organization_id: params.organizationId,
        ad_campaign_id: adCampaignId,
        ad_set_id: setId,
        headline: typeof ad.headline === "string" ? ad.headline.slice(0, 120) : null,
        primary_text: typeof ad.primaryText === "string" ? ad.primaryText : typeof ad.primary_text === "string" ? ad.primary_text : null,
        description: typeof ad.description === "string" ? ad.description : null,
        cta: typeof ad.cta === "string" ? ad.cta : null,
        destination_url: typeof ad.destinationUrl === "string" ? ad.destinationUrl : params.destinationUrl,
        status: "draft",
        metadata: { creativeConcept: ad.creativeConcept ?? null },
        updated_at: nowIso(),
      } as never)
      .select("id")
      .single();
    if (!adErr && adRow) insertedAds.push(String((adRow as any).id));
  };

  if (Array.isArray(params.platformDraft.adSets)) {
    let setIdx = 0;
    for (const s of params.platformDraft.adSets as unknown[]) {
      const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      const setId = insertedSets[setIdx] ?? null;
      const ads = Array.isArray(o.ads) ? (o.ads as unknown[]) : [];
      for (const a of ads) {
        await insertAd(setId, (a && typeof a === "object" ? a : {}) as Record<string, unknown>);
      }
      setIdx += 1;
    }
  } else {
    // Google-like shape: still create a couple ads from creative headlines list.
    const headlines = Array.isArray(params.creativeJson.headlines) ? (params.creativeJson.headlines as unknown[]) : [];
    for (let i = 0; i < Math.min(5, headlines.length || 3); i++) {
      await insertAd(insertedSets[0] ?? null, {
        headline: typeof headlines[i] === "string" ? headlines[i] : `Ad ${i + 1}`,
        primaryText:
          Array.isArray(params.creativeJson.primaryTexts) && typeof params.creativeJson.primaryTexts[i] === "string"
            ? String(params.creativeJson.primaryTexts[i])
            : `${params.draftName}`,
        description:
          Array.isArray(params.creativeJson.descriptions) && typeof params.creativeJson.descriptions[i] === "string"
            ? String(params.creativeJson.descriptions[i])
            : "",
        cta: Array.isArray(params.creativeJson.ctas) && typeof params.creativeJson.ctas[i] === "string" ? String(params.creativeJson.ctas[i]) : "Learn more",
        destinationUrl: params.destinationUrl,
      });
    }
  }

  await admin.from("analytics_events" as never).insert({
    organization_id: params.organizationId,
    campaign_id: params.campaignId,
    event_name: "ads.draft.created",
    source: "adsDraftService",
    metadata: { ad_campaign_id: adCampaignId, ads_created: insertedAds.length, ad_sets_created: insertedSets.length },
    created_at: nowIso(),
  } as never);

  return { adCampaignId, adSetIds: insertedSets, adIds: insertedAds };
}
