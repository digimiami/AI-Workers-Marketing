import type { SupabaseClient } from "@supabase/supabase-js";

import { asMetadataRecord } from "@/lib/mergeJsonbRecords";

export type GrowthSubsystemHealth = "ok" | "partial" | "missing" | "blocked";

export type GrowthSubsystemStatus = {
  key: string;
  label: string;
  health: GrowthSubsystemHealth;
  detail: string;
};

function metaUrlGoal(meta: Record<string, unknown>) {
  const url = typeof meta.url === "string" ? meta.url : "";
  const goal = typeof meta.goal === "string" ? meta.goal : "";
  const audience = typeof meta.audience === "string" ? meta.audience : "";
  const traffic = typeof meta.traffic_source === "string" ? meta.traffic_source : "";
  return { url, goal, audience, traffic };
}

/**
 * Read-only health map for the Growth Engine operator dashboard (mirrors the architecture diagram).
 */
export async function buildGrowthSystemStatus(params: {
  supabase: SupabaseClient;
  organizationId: string;
  campaignId: string;
}): Promise<{ subsystems: GrowthSubsystemStatus[]; meta: Record<string, unknown> }> {
  const { supabase, organizationId, campaignId } = params;

  const [{ data: camp }, { data: funnel }, { data: variants }, { data: adRows }, { data: seq }, evRecentRes] = await Promise.all([
    supabase.from("campaigns" as never).select("metadata,status").eq("organization_id", organizationId).eq("id", campaignId).maybeSingle(),
    supabase.from("funnels" as never).select("id").eq("organization_id", organizationId).eq("campaign_id", campaignId).limit(1).maybeSingle(),
    supabase
      .from("landing_page_variants" as never)
      .select("id,variant_key,selected,content")
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .limit(20),
    supabase
      .from("ad_campaigns" as never)
      .select("id,status")
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .limit(10),
    supabase
      .from("email_sequences" as never)
      .select("id")
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("analytics_events" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()),
  ]);

  const meta = asMetadataRecord((camp as { metadata?: unknown } | null)?.metadata);
  const ge = asMetadataRecord(meta.growth_engine);
  const { url, goal, audience, traffic } = metaUrlGoal(meta);
  const research = asMetadataRecord(ge.url_research);
  const classification = asMetadataRecord(ge.business_classification);
  const variantScoring = asMetadataRecord(ge.variant_scoring as unknown);
  const landingFix = asMetadataRecord(ge.landing_fix as unknown);
  const cycles = Array.isArray(ge.optimization_loop_cycles) ? (ge.optimization_loop_cycles as unknown[]) : [];
  const lastCycle = cycles.length ? asMetadataRecord(cycles[cycles.length - 1] as unknown) : {};

  const variantList = (variants ?? []) as Array<{ id: string; variant_key: string }>;
  const ads = (adRows ?? []) as Array<{ status: string }>;
  const funnelRow = funnel as { id?: string } | null;
  const seqRow = seq as { id?: string } | null;

  const inputOk = Boolean(url && goal && audience && traffic);
  const researchOk = Boolean(
    (typeof research.offerSummary === "string" && research.offerSummary.trim().length > 12) ||
      (typeof research.businessName === "string" && research.businessName.trim().length > 1),
  );
  const strategyOk = Boolean(
    (typeof classification.classification === "string" && String(classification.classification).length > 2) ||
      (typeof classification.bestFunnelType === "string" && String(classification.bestFunnelType).length > 2),
  );
  const funnelOk = Boolean(funnelRow?.id);
  const genLanding = variantList.length > 0;
  const genAds = ads.length > 0;
  const genEmail = Boolean(seqRow?.id);
  const generationOk = genLanding && (genAds || genEmail);
  const variantEngineOk = variantList.length >= 2;
  const scoringOk = typeof variantScoring.scored_at === "string" && String(variantScoring.scored_at).length > 8;
  const launchOk = ads.some((a) => a.status === "active" || a.status === "live" || a.status === "running");
  const liveOk = Number((evRecentRes as { count?: number } | null)?.count ?? 0) >= 3;
  const loopOk = cycles.length > 0 && typeof lastCycle.at === "string";

  const blocked = ge.landing_status === "needs_generation_fix";

  const subsystems: GrowthSubsystemStatus[] = [
    {
      key: "input",
      label: "1 · Input",
      health: inputOk ? "ok" : "missing",
      detail: inputOk ? "URL, goal, audience, and traffic source are set." : "Complete campaign inputs (URL, goal, audience, traffic).",
    },
    {
      key: "research",
      label: "2 · AI research",
      health: researchOk ? "ok" : inputOk ? "partial" : "missing",
      detail: researchOk ? "URL research payload present." : "Run the growth engine or regenerate research.",
    },
    {
      key: "strategy",
      label: "3 · Campaign strategy",
      health: strategyOk ? "ok" : researchOk ? "partial" : "missing",
      detail: strategyOk ? "Business classification / funnel type captured." : "Classification not persisted yet.",
    },
    {
      key: "funnel_blueprint",
      label: "4 · Funnel blueprint",
      health: funnelOk ? "ok" : "missing",
      detail: funnelOk ? "Funnel record exists for this campaign." : "Create / generate funnel for this campaign.",
    },
    {
      key: "generation_suite",
      label: "5 · AI generation suite",
      health: blocked ? "blocked" : generationOk ? "ok" : genLanding ? "partial" : "missing",
      detail: blocked
        ? `Landing fix required: ${String(landingFix.reason ?? "unknown")}.`
        : generationOk
          ? "Landing variants plus ads or email assets detected."
          : "Generate landing variants and supporting assets.",
    },
    {
      key: "variant_engine",
      label: "6 · Variant engine",
      health: variantEngineOk ? "ok" : genLanding ? "partial" : "missing",
      detail: variantEngineOk ? `${variantList.length} variants available for testing.` : "Need multiple variants for meaningful tests.",
    },
    {
      key: "scoring",
      label: "7 · AI scoring engine",
      health: scoringOk ? "ok" : variantList.length ? "partial" : "missing",
      detail: scoringOk ? `Last scored at ${variantScoring.scored_at}.` : "Run “Score variants” on the Growth Engine dashboard.",
    },
    {
      key: "launch",
      label: "8 · Launch system",
      health: launchOk ? "ok" : genAds ? "partial" : "missing",
      detail: launchOk ? "At least one paid campaign is active." : "Prepare / simulate launch; live mode requires approvals.",
    },
    {
      key: "live_marketing",
      label: "Live marketing",
      health: liveOk ? "ok" : "partial",
      detail: liveOk ? "Recent analytics events on this campaign (7d)." : "Waiting for traffic events (page views, leads, etc.).",
    },
    {
      key: "optimization_loop",
      label: "AI optimization loop",
      health: loopOk ? "ok" : "partial",
      detail: loopOk ? `Last loop cycle: ${String(lastCycle.at)}.` : "Run “Optimization loop” to collect + analyze + record decisions.",
    },
  ];

  return { subsystems, meta: { campaign_status: (camp as { status?: string } | null)?.status ?? null } };
}
