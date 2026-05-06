import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ADS_OPTIMIZATION_SYSTEM, buildAdsOptimizationUserPrompt } from "@/ai/prompts/optimization_prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

function safeParseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function runAdsOptimization(params: {
  organizationId: string;
  campaignId: string;
  platform?: string | null;
  autopilotEnabled?: boolean;
}) {
  const admin = createSupabaseAdminClient();

  const { data: events, error } = await admin
    .from("ad_performance_events" as never)
    .select("ad_id,platform,impressions,clicks,spend,leads,conversions,ctr,cpl,captured_at")
    .eq("organization_id", params.organizationId)
    .eq("campaign_id", params.campaignId)
    .order("captured_at", { ascending: false })
    .limit(400);
  if (error) throw new Error(error.message);

  const metrics = (events ?? []) as any[];

  const prompt = buildAdsOptimizationUserPrompt({
    campaignName: params.campaignId,
    platform: params.platform ?? "mixed",
    autopilotEnabled: Boolean(params.autopilotEnabled),
    metrics: metrics.map((m) => ({
      ad_id: m.ad_id,
      platform: m.platform,
      impressions: m.impressions,
      clicks: m.clicks,
      spend: m.spend,
      leads: m.leads,
      conversions: m.conversions,
      ctr: m.ctr,
      cpl: m.cpl,
      captured_at: m.captured_at,
    })),
  });

  const out = await runStrictJsonPrompt({
    system: ADS_OPTIMIZATION_SYSTEM,
    user: prompt,
    fallbackJsonText: JSON.stringify({
      summary: "Not enough signal yet—collect more impressions/clicks before aggressive changes.",
      winners: [],
      losers: [],
      recommendations: [
        "Wait for ~1–3k impressions per ad before judging CTR.",
        "If clicks are high but leads are low, tighten landing promise vs ad claim.",
      ],
      suggestedActions: [
        {
          action: "swap_creative",
          rationale: "Explore new hooks if CTR is below benchmark for the platform.",
          risk: "low",
          requiresApproval: true,
        },
      ],
    }),
  });

  const parsed = safeParseJson(out.jsonText);

  await admin.from("campaign_recommendations" as never).insert({
    organization_id: params.organizationId,
    campaign_id: params.campaignId,
    status: "draft",
    title: "Paid ads optimization review",
    recommendation_json: { optimization: parsed, meta: out.meta },
    created_at: new Date().toISOString(),
  } as never);

  return { ...parsed, meta: out.meta };
}
