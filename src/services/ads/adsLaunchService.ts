import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdsProviderMode } from "@/services/ads/adsProviderTypes";
import { googleAdsCreateCampaignLive, googleAdsCreateCampaignStub, googleAdsEnsureLiveProvisioned } from "@/services/ads/googleAdsProvider";
import { metaAdsCreateCampaignLive, metaAdsCreateCampaignStub, metaAdsEnsureLiveProvisioned } from "@/services/ads/metaAdsProvider";

function nowIso() {
  return new Date().toISOString();
}

export async function attachProviderIds(params: {
  organizationId: string;
  adCampaignId: string;
  platform: "google" | "meta";
  mode: AdsProviderMode;
  name: string;
}) {
  if (params.platform === "google") await googleAdsEnsureLiveProvisioned(params.mode);
  if (params.platform === "meta") await metaAdsEnsureLiveProvisioned(params.mode);

  const ids =
    params.platform === "google"
      ? params.mode === "live"
        ? await googleAdsCreateCampaignLive({ campaignName: params.name })
        : await googleAdsCreateCampaignStub({ campaignName: params.name })
      : params.mode === "live"
        ? await metaAdsCreateCampaignLive({ campaignName: params.name })
        : await metaAdsCreateCampaignStub({ campaignName: params.name });

  const admin = createSupabaseAdminClient();

  await admin
    .from("ad_campaigns" as never)
    .update(
      {
        provider_campaign_id: ids.providerCampaignId ?? null,
        status: params.mode === "live" ? "active" : "simulated_active",
        metadata: { provider_mode: params.mode, provider_ids: ids },
        updated_at: nowIso(),
      } as never,
    )
    .eq("organization_id", params.organizationId)
    .eq("id", params.adCampaignId);

  const sets = await admin
    .from("ad_sets" as never)
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("ad_campaign_id", params.adCampaignId)
    .order("created_at", { ascending: true })
    .limit(50);
  const setIds = ((sets.data ?? []) as any[]).map((r) => String(r.id));

  for (let i = 0; i < setIds.length; i++) {
    const pid = ids.providerAdSetIds?.[i];
    if (!pid) break;
    await admin
      .from("ad_sets" as never)
      .update({ provider_ad_set_id: pid, status: params.mode === "live" ? "active" : "simulated_active", updated_at: nowIso() } as never)
      .eq("organization_id", params.organizationId)
      .eq("id", setIds[i]);
  }

  const ads = await admin
    .from("ads" as never)
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("ad_campaign_id", params.adCampaignId)
    .order("created_at", { ascending: true })
    .limit(200);
  const adIds = ((ads.data ?? []) as any[]).map((r) => String(r.id));
  for (let i = 0; i < adIds.length; i++) {
    const pid = ids.providerAdIds?.[i];
    if (!pid) break;
    await admin
      .from("ads" as never)
      .update({ provider_ad_id: pid, status: params.mode === "live" ? "active" : "simulated_active", updated_at: nowIso() } as never)
      .eq("organization_id", params.organizationId)
      .eq("id", adIds[i]);
  }

  return { providerIds: ids };
}

export async function emitStubPerformanceSnapshot(params: {
  organizationId: string;
  campaignId: string;
  platform: "google" | "meta";
  adRows: Array<{ id: string }>;
}) {
  const admin = createSupabaseAdminClient();
  const now = nowIso();
  for (const a of params.adRows.slice(0, 25)) {
    const impressions = 800 + Math.floor(Math.random() * 2500);
    const clicks = Math.max(5, Math.floor(impressions * (0.004 + Math.random() * 0.02)));
    const spend = Math.max(1, Math.round((5 + Math.random() * 35) * 100) / 100);
    const leads = Math.floor(Math.random() * 6);
    const ctr = impressions ? clicks / impressions : 0;
    const cpc = clicks ? spend / clicks : null;
    const cpl = leads ? spend / leads : null;

    await admin.from("ad_performance_events" as never).insert({
      organization_id: params.organizationId,
      campaign_id: params.campaignId,
      platform: params.platform,
      ad_id: a.id,
      impressions,
      clicks,
      spend,
      leads,
      conversions: Math.floor(leads * (Math.random() > 0.6 ? 1 : 0)),
      ctr,
      cpc,
      cpl,
      metadata: { kind: "stub_snapshot" },
      captured_at: now,
    } as never);
  }
}
