import { env } from "@/lib/env";

export type TrackingIds = {
  cid: string;
  campaignSlug: string;
  variantId?: string | null;
  adId?: string | null;
};

function baseSiteUrl() {
  const u = env.server.APP_BASE_URL ?? "http://localhost:3000";
  return u.replace(/\/$/, "");
}

export function buildCampaignSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildAdSlug(headline: string, idx: number) {
  const base = headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `${base || "ad"}-${idx + 1}`;
}

/** Adds required tracking params for attribution + downstream analytics joins. */
export function buildTrackedLandingUrl(params: {
  destinationPathOrUrl: string;
  platform: "google" | "meta" | "tiktok";
  ids: TrackingIds;
  utmContent?: string;
}) {
  const base = params.destinationPathOrUrl.startsWith("http") ? params.destinationPathOrUrl : `${baseSiteUrl()}${params.destinationPathOrUrl}`;
  const u = new URL(base);
  const utmSource = params.platform === "google" ? "google" : params.platform === "meta" ? "meta" : "tiktok";
  u.searchParams.set("utm_source", utmSource);
  u.searchParams.set("utm_medium", "cpc");
  u.searchParams.set("utm_campaign", params.ids.campaignSlug);
  u.searchParams.set("utm_content", params.utmContent ?? "variant");
  u.searchParams.set("cid", params.ids.cid);
  if (params.ids.adId) u.searchParams.set("ad_id", params.ids.adId);
  if (params.ids.variantId) u.searchParams.set("variant_id", params.ids.variantId);
  return u.toString();
}
