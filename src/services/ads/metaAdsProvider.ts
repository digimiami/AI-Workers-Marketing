import { env } from "@/lib/env";
import type { AdsProviderMode, ProviderCampaignIds } from "@/services/ads/adsProviderTypes";

export async function metaAdsEnsureLiveProvisioned(mode: AdsProviderMode): Promise<void> {
  if (mode !== "live") return;
  const missing = [
    env.server.META_APP_ID,
    env.server.META_APP_SECRET,
    env.server.META_ACCESS_TOKEN,
    env.server.META_AD_ACCOUNT_ID,
  ].some((x) => !x);
  if (missing) {
    throw new Error("Meta Ads live mode requested but provider credentials are incomplete.");
  }
}

export async function metaAdsCreateCampaignStub(input: { campaignName: string }): Promise<ProviderCampaignIds> {
  const slug = input.campaignName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return {
    providerCampaignId: `stub_meta_campaign_${slug || "campaign"}`,
    providerAdSetIds: [`stub_meta_adset_${slug || "as"}_cold`, `stub_meta_adset_${slug || "as"}_rt`],
    providerAdIds: [`stub_meta_ad_${slug || "ad"}_1`, `stub_meta_ad_${slug || "ad"}_2`, `stub_meta_ad_${slug || "ad"}_3`],
  };
}

export async function metaAdsCreateCampaignLive(_input: { campaignName: string }): Promise<ProviderCampaignIds> {
  throw new Error("Meta Ads live creation is not wired yet (stub-only integration).");
}
