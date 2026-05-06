import crypto from "crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { env } from "@/lib/env";
import type { AdsProviderMode } from "@/services/ads/adsProviderTypes";
import { generatePaidAdsDraftPack, persistDraftIntoDb } from "@/services/ads/adsDraftService";
import { attachProviderIds, emitStubPerformanceSnapshot } from "@/services/ads/adsLaunchService";

function nowIso() {
  return new Date().toISOString();
}

function providerModeFromEnv(): AdsProviderMode {
  const m = (env.server.ADS_PROVIDER_MODE ?? "stub").toLowerCase();
  return m === "live" ? "live" : "stub";
}

async function resolveMarketingInputs(admin: ReturnType<typeof createSupabaseAdminClient>, organizationId: string, campaignId: string) {
  const { data: camp } = await admin
    .from("campaigns" as never)
    .select("id,name,metadata")
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle();
  const meta = ((camp as any)?.metadata ?? {}) as Record<string, unknown>;
  const url = typeof meta.url === "string" ? meta.url : typeof meta.site_url === "string" ? meta.site_url : "";
  const goal = typeof meta.goal === "string" ? meta.goal : String(meta.goal ?? "");
  const audience = typeof meta.audience === "string" ? meta.audience : String(meta.audience ?? "");
  const trafficSource = typeof meta.traffic_source === "string" ? meta.traffic_source : "paid_social";
  return {
    campaignName: typeof (camp as any)?.name === "string" ? String((camp as any).name) : "Campaign",
    url,
    goal,
    audience,
    trafficSource,
  };
}

async function resolveLandingDestination(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  organizationId: string;
  campaignId: string;
  landingPageVariantId?: string | null;
}) {
  const admin = params.admin;
  const { data: camp } = await admin
    .from("campaigns" as never)
    .select("funnel_id")
    .eq("organization_id", params.organizationId)
    .eq("id", params.campaignId)
    .maybeSingle();
  const funnelId = (camp as any)?.funnel_id ? String((camp as any).funnel_id) : null;
  if (!funnelId) return { destinationPath: `/f/${params.campaignId}`, slug: "home", variantKey: null as string | null, variantId: null as string | null };

  const { data: steps } = await admin
    .from("funnel_steps" as never)
    .select("id,slug,step_type,step_index")
    .eq("organization_id", params.organizationId)
    .eq("funnel_id", funnelId)
    .eq("is_public", true)
    .order("step_index", { ascending: true })
    .limit(50);

  const landingStep =
    ((steps ?? []) as any[]).find((s) => String(s.step_type) === "landing") ?? ((steps ?? []) as any[])[0];
  const slug = landingStep?.slug ? String(landingStep.slug) : "home";

  let variantKey: string | null = null;
  let variantId: string | null = null;

  if (params.landingPageVariantId) {
    const { data: v } = await admin
      .from("landing_page_variants" as never)
      .select("id,variant_key")
      .eq("organization_id", params.organizationId)
      .eq("campaign_id", params.campaignId)
      .eq("id", params.landingPageVariantId)
      .maybeSingle();
    variantKey = (v as any)?.variant_key ? String((v as any).variant_key) : null;
    variantId = (v as any)?.id ? String((v as any).id) : null;
  } else {
    const { data: v } = await admin
      .from("landing_page_variants" as never)
      .select("id,variant_key")
      .eq("organization_id", params.organizationId)
      .eq("campaign_id", params.campaignId)
      .eq("selected", true)
      .maybeSingle();
    if (v) {
      variantKey = String((v as any).variant_key);
      variantId = String((v as any).id);
    }
  }

  const qs = variantKey ? `?variant=${encodeURIComponent(variantKey)}` : "";
  return { destinationPath: `/f/${params.campaignId}/${encodeURIComponent(slug)}${qs}`, slug, variantKey, variantId };
}

async function createApproval(params: {
  organizationId: string;
  campaignId: string;
  approvalType: string;
  payload: Record<string, unknown>;
  ad_campaign_id?: string | null;
  ad_set_id?: string | null;
  ad_id?: string | null;
  landing_page_variant_id?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const target =
    params.ad_campaign_id
      ? { type: "ad_campaign", id: params.ad_campaign_id }
      : params.ad_set_id
        ? { type: "ad_set", id: params.ad_set_id }
        : params.ad_id
          ? { type: "ad", id: params.ad_id }
          : params.landing_page_variant_id
            ? { type: "landing_page_variant", id: params.landing_page_variant_id }
            : null;
  const { data, error } = await admin
    .from("approvals" as never)
    .insert({
      organization_id: params.organizationId,
      campaign_id: params.campaignId,
      status: "pending",
      approval_type: params.approvalType,
      reason_required: true,
      payload: params.payload,
      target_entity_type: target?.type ?? null,
      target_entity_id: target?.id ?? null,
      action: params.approvalType,
      metadata: { kind: "paid_ads" },
      created_at: nowIso(),
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create approval");
  return String((data as any).id);
}

export async function preparePaidAdsLaunch(input: {
  orgId: string;
  campaignId: string;
  platform: "google" | "meta";
  dailyBudget: number;
  objective: string;
  landingPageVariantId?: string | null;
  approvalMode: "required" | "optional";
}) {
  const admin = createSupabaseAdminClient();
  const mode = providerModeFromEnv();

  const ctx = await resolveMarketingInputs(admin, input.orgId, input.campaignId);
  const dest = await resolveLandingDestination({
    admin,
    organizationId: input.orgId,
    campaignId: input.campaignId,
    landingPageVariantId: input.landingPageVariantId ?? null,
  });

  const cid = crypto.randomUUID();

  const pack = await generatePaidAdsDraftPack({
    organizationId: input.orgId,
    campaignId: input.campaignId,
    platform: input.platform,
    dailyBudget: input.dailyBudget,
    objective: input.objective,
    destinationPath: dest.destinationPath,
    tracking: { cid, campaignName: ctx.campaignName, variantId: dest.variantId },
    context: {
      url: ctx.url || "https://example.com",
      goal: ctx.goal || "Generate qualified leads",
      audience: ctx.audience || "Prospects matching the offer",
      trafficSource: ctx.trafficSource || "paid",
    },
  });

  const persisted = await persistDraftIntoDb({
    organizationId: input.orgId,
    campaignId: input.campaignId,
    platform: input.platform,
    dailyBudget: input.dailyBudget,
    objective: input.objective,
    destinationUrl: pack.destinationUrl,
    destinationPath: dest.destinationPath,
    draftName: `${ctx.campaignName} · ${input.platform}`,
    platformDraft: pack.platformDraft,
    creativeJson: pack.creativeJson,
  });

  // Always create approval gates for paid launch (even stub), unless explicitly optional AND operator acknowledges risk (still record audit via approvals optional=false default).
  const approvalIds: string[] = [];
  if (input.approvalMode === "required") {
    approvalIds.push(
      await createApproval({
        organizationId: input.orgId,
        campaignId: input.campaignId,
        approvalType: "paid_ads_launch",
        ad_campaign_id: persisted.adCampaignId,
        payload: {
          platform: input.platform,
          mode,
          ad_campaign_id: persisted.adCampaignId,
          destination_url: pack.destinationUrl,
          objective: input.objective,
          daily_budget: input.dailyBudget,
          preview: { ads: persisted.adIds.slice(0, 8) },
        },
      }),
    );
    approvalIds.push(
      await createApproval({
        organizationId: input.orgId,
        campaignId: input.campaignId,
        approvalType: "paid_ads_budget",
        ad_campaign_id: persisted.adCampaignId,
        payload: {
          daily_budget: input.dailyBudget,
          currency: "USD",
          note: "Approving spend authorization for the drafted campaign budget.",
        },
      }),
    );
    approvalIds.push(
      await createApproval({
        organizationId: input.orgId,
        campaignId: input.campaignId,
        approvalType: "paid_ads_destination",
        ad_campaign_id: persisted.adCampaignId,
        landing_page_variant_id: dest.variantId,
        payload: {
          destination_url: pack.destinationUrl,
          landing_slug: dest.slug,
          variant_key: dest.variantKey,
          variant_id: dest.variantId,
        },
      }),
    );
    approvalIds.push(
      await createApproval({
        organizationId: input.orgId,
        campaignId: input.campaignId,
        approvalType: "paid_ads_copy",
        ad_campaign_id: persisted.adCampaignId,
        payload: {
          creative_pack: pack.creativeJson,
          risk_notes: [
            "Verify claims match the landing page and legal/compliance constraints.",
            "Confirm pricing/availability statements if referenced.",
          ],
        },
      }),
    );
  }

  const { data: campMetaRow } = await admin.from("campaigns" as never).select("metadata").eq("id", input.campaignId).maybeSingle();
  const prevMeta = asMetadataRecord((campMetaRow as any)?.metadata);
  const nextMeta = mergeJsonbRecords(prevMeta, {
    ads_engine: {
      provider_mode: mode,
      last_prepare_at: nowIso(),
      last_ad_campaign_id: persisted.adCampaignId,
      tracking_url: pack.destinationUrl,
      prepare_status: "draft_ready",
    },
  });

  await admin
    .from("campaigns" as never)
    .update({ metadata: nextMeta, updated_at: nowIso() } as never)
    .eq("id", input.campaignId)
    .eq("organization_id", input.orgId);

  return {
    adCampaignId: persisted.adCampaignId,
    adSetIds: persisted.adSetIds,
    adIds: persisted.adIds,
    trackingUrl: pack.destinationUrl,
    approvalId: approvalIds[0] ?? null,
    providerMode: mode,
    status: "approval_required",
    approvalIds,
    meta: pack.meta,
  };
}

export async function launchPaidAdsAfterApprovals(params: {
  organizationId: string;
  campaignId: string;
  adCampaignId: string;
  platform: "google" | "meta";
}) {
  const mode = providerModeFromEnv();
  const admin = createSupabaseAdminClient();
  const { data: camp } = await admin.from("campaigns" as never).select("name").eq("id", params.campaignId).maybeSingle();
  const name = String((camp as any)?.name ?? "campaign");
  await attachProviderIds({
    organizationId: params.organizationId,
    adCampaignId: params.adCampaignId,
    platform: params.platform,
    mode,
    name,
  });

  const { data: ads } = await admin
    .from("ads" as never)
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("ad_campaign_id", params.adCampaignId)
    .limit(200);
  await emitStubPerformanceSnapshot({
    organizationId: params.organizationId,
    campaignId: params.campaignId,
    platform: params.platform,
    adRows: ((ads ?? []) as any[]).map((r) => ({ id: String(r.id) })),
  });

  const { data: campMetaRow } = await admin.from("campaigns" as never).select("metadata").eq("id", params.campaignId).maybeSingle();
  const prevMeta = asMetadataRecord((campMetaRow as any)?.metadata);
  const nextMeta = mergeJsonbRecords(prevMeta, {
    ads_engine: {
      last_launch_at: nowIso(),
      launch_status: mode === "live" ? "live_launched" : "stub_simulated_active",
      last_ad_campaign_id: params.adCampaignId,
    },
  });
  await admin.from("campaigns" as never).update({ metadata: nextMeta, updated_at: nowIso() } as never).eq("id", params.campaignId).eq("organization_id", params.organizationId);

  return { ok: true, mode };
}
