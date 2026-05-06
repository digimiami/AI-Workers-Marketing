import { env } from "@/lib/env";
import type { AdsProviderMode, ProviderCampaignIds } from "@/services/ads/adsProviderTypes";

export async function googleAdsEnsureLiveProvisioned(mode: AdsProviderMode): Promise<void> {
  if (mode !== "live") return;
  const missing = [
    env.server.GOOGLE_ADS_CLIENT_ID,
    env.server.GOOGLE_ADS_CLIENT_SECRET,
    env.server.GOOGLE_ADS_DEVELOPER_TOKEN,
    env.server.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  ].some((x) => !x);
  if (missing) {
    throw new Error("Google Ads live mode requested but provider credentials are incomplete.");
  }
}

export async function googleAdsCreateCampaignStub(input: { campaignName: string }): Promise<ProviderCampaignIds> {
  const slug = input.campaignName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return {
    providerCampaignId: `stub_google_campaign_${slug || "campaign"}`,
    providerAdSetIds: [`stub_google_adgroup_${slug || "ag"}_a`, `stub_google_adgroup_${slug || "ag"}_b`],
    providerAdIds: [`stub_google_ad_${slug || "ad"}_1`, `stub_google_ad_${slug || "ad"}_2`, `stub_google_ad_${slug || "ad"}_3`],
  };
}

export async function googleAdsCreateCampaignLive(_input: { campaignName: string }): Promise<ProviderCampaignIds> {
  throw new Error("Google Ads live creation is not wired yet (stub-only integration).");
}
