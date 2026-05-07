import { env } from "@/lib/env";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { preparePaidAdsLaunch, launchPaidAdsAfterApprovals } from "@/services/ads/adsEngine";
import { runGrowthOptimizationFromDb } from "@/services/growth/optimizationEngineService";
import { computeCampaignMetrics } from "@/services/analytics/metricsEngine";

function nowIso() {
  return new Date().toISOString();
}

function autoSettings(metadata: unknown) {
  const m = asMetadataRecord(metadata);
  const ge = asMetadataRecord(m.growth_engine);
  const auto = asMetadataRecord(ge.auto_mode);
  return {
    enabled: Boolean(auto.enabled),
    autoLaunchApproved: Boolean(auto.auto_launch_approved),
    autoScaleApproved: Boolean(auto.auto_scale_approved),
    targetCpl: typeof auto.target_cpl === "number" ? Number(auto.target_cpl) : 30,
    minConversionRate: typeof auto.min_conversion_rate === "number" ? Number(auto.min_conversion_rate) : 0.08,
  };
}

export async function autoLaunchAds(input: { organizationId?: string; limit?: number }) {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from("campaigns" as never)
    .select("id,organization_id,name,metadata")
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);
  if (input.organizationId) q = q.eq("organization_id", input.organizationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const results: Array<Record<string, unknown>> = [];
  for (const c of (data ?? []) as any[]) {
    const settings = autoSettings(c.metadata);
    if (!settings.enabled) continue;

    const orgId = String(c.organization_id);
    const campaignId = String(c.id);
    const platform = String(asMetadataRecord(asMetadataRecord(c.metadata).ads_engine).platform ?? "meta") === "google" ? "google" : "meta";
    const dailyBudget = Number(asMetadataRecord(asMetadataRecord(c.metadata).ads_engine).daily_budget ?? 25);

    try {
      const { count } = await admin
        .from("ad_campaigns" as never)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("campaign_id", campaignId)
        .eq("platform", platform);

      let prepared: any = null;
      if ((count ?? 0) === 0) {
        prepared = await preparePaidAdsLaunch({
          orgId,
          campaignId,
          platform,
          dailyBudget,
          objective: "leads",
          approvalMode: settings.autoLaunchApproved ? "optional" : "required",
        });
      }

      if (settings.autoLaunchApproved && prepared?.adCampaignId) {
        await launchPaidAdsAfterApprovals({
          organizationId: orgId,
          campaignId,
          adCampaignId: String(prepared.adCampaignId),
          platform,
        });
      }

      await admin.from("analytics_events" as never).insert({
        organization_id: orgId,
        campaign_id: campaignId,
        event_name: "automation.ads_auto_launch",
        source: "ads_auto_engine",
        properties: {
          provider_mode: env.server.ADS_PROVIDER_MODE ?? "stub",
          platform,
          prepared_ad_campaign_id: prepared?.adCampaignId ?? null,
          auto_launch_approved: settings.autoLaunchApproved,
        },
        created_at: nowIso(),
      } as never);

      results.push({ campaignId, platform, prepared: Boolean(prepared), launched: Boolean(settings.autoLaunchApproved && prepared?.adCampaignId) });
    } catch (e) {
      results.push({ campaignId, error: e instanceof Error ? e.message : "auto launch failed" });
    }
  }

  return { processed: results.length, results };
}

export async function autoOptimizeCampaigns(input: { organizationId?: string; limit?: number }) {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from("campaigns" as never)
    .select("id,organization_id,name,metadata")
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);
  if (input.organizationId) q = q.eq("organization_id", input.organizationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const results: Array<Record<string, unknown>> = [];
  for (const c of (data ?? []) as any[]) {
    const settings = autoSettings(c.metadata);
    if (!settings.enabled) continue;
    const orgId = String(c.organization_id);
    const campaignId = String(c.id);
    try {
      const metrics = await computeCampaignMetrics({ organizationId: orgId, campaignId });
      const optimization = await runGrowthOptimizationFromDb({ organizationId: orgId, campaignId, autopilotEnabled: true });
      const prev = asMetadataRecord(c.metadata);
      const next = mergeJsonbRecords(prev, {
        growth_engine: {
          auto_mode: {
            last_optimized_at: nowIso(),
            last_metrics: metrics,
            last_optimization: optimization,
          },
        },
      });
      await admin
        .from("campaigns" as never)
        .update({ metadata: next, updated_at: nowIso() } as never)
        .eq("organization_id", orgId)
        .eq("id", campaignId);
      results.push({ campaignId, metrics, optimization });
    } catch (e) {
      results.push({ campaignId, error: e instanceof Error ? e.message : "optimization failed" });
    }
  }
  return { processed: results.length, results };
}

export async function scaleWinners(input: { organizationId?: string; limit?: number }) {
  const admin = createSupabaseAdminClient();
  let q = admin.from("campaigns" as never).select("id,organization_id,metadata").limit(input.limit ?? 50);
  if (input.organizationId) q = q.eq("organization_id", input.organizationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const decisions: Array<Record<string, unknown>> = [];
  for (const c of (data ?? []) as any[]) {
    const settings = autoSettings(c.metadata);
    if (!settings.enabled) continue;
    const orgId = String(c.organization_id);
    const campaignId = String(c.id);
    const metrics = await computeCampaignMetrics({ organizationId: orgId, campaignId });

    const isWinner = metrics.cpl > 0 && metrics.cpl <= settings.targetCpl && metrics.conversionRate >= settings.minConversionRate;
    const isLoser = metrics.clicks >= 100 && metrics.conversions === 0;

    if (isWinner && settings.autoScaleApproved) {
      const { data: adCampaigns } = await admin
        .from("ad_campaigns" as never)
        .select("id,daily_budget")
        .eq("organization_id", orgId)
        .eq("campaign_id", campaignId)
        .limit(20);
      for (const ac of (adCampaigns ?? []) as any[]) {
        const current = Number(ac.daily_budget ?? 25);
        await admin
          .from("ad_campaigns" as never)
          .update({ daily_budget: Math.round(current * 1.15 * 100) / 100, updated_at: nowIso() } as never)
          .eq("organization_id", orgId)
          .eq("id", String(ac.id));
      }
      decisions.push({ campaignId, action: "scale_budget_15_percent", metrics });
    } else if (isLoser) {
      await admin
        .from("ad_campaigns" as never)
        .update({ status: "paused", updated_at: nowIso() } as never)
        .eq("organization_id", orgId)
        .eq("campaign_id", campaignId);
      decisions.push({ campaignId, action: "pause_losing_ads", metrics });
    } else {
      decisions.push({ campaignId, action: "hold_collect_more_data", metrics });
    }
  }

  return { processed: decisions.length, decisions };
}

