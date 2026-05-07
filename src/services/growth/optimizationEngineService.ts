import { buildOptimizationEngineUserPrompt, OPTIMIZATION_ENGINE_SYSTEM } from "@/ai/prompts/optimization_engine.prompt";
import { asMetadataRecord } from "@/lib/mergeJsonbRecords";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function runOptimizationEngine(input: {
  campaignName: string;
  autopilotEnabled: boolean;
  metrics: Record<string, unknown>;
  funnelSummary: Record<string, unknown> | null;
}): Promise<Record<string, unknown>> {
  const fallbackJsonText = JSON.stringify({
    summary: "Baseline: collect CTR, CPL, and landing conversion rate before aggressive changes.",
    winners: [],
    losers: [],
    recommendations: [
      {
        priority: "high",
        action: "Verify tracking + attribution on landing URLs",
        reason: "Without clean measurement, optimization will misfire.",
        expectedImpact: "Higher confidence decisions within 7 days",
      },
    ],
    suggestedActions: [
      {
        type: "improve_landing",
        description: "Add a second CTA block after proof sections.",
        requiresApproval: true,
      },
    ],
  });

  const out = await runStrictJsonPrompt({
    system: OPTIMIZATION_ENGINE_SYSTEM,
    user: buildOptimizationEngineUserPrompt({
      campaignName: input.campaignName,
      autopilotEnabled: input.autopilotEnabled,
      metrics: input.metrics,
      funnelSummary: input.funnelSummary,
    }),
    fallbackJsonText,
  });
  return safeParseRecord(out.jsonText);
}

/** Loads latest ad performance rows + stored funnel visualization, then runs the growth optimization JSON prompt. */
export async function runGrowthOptimizationFromDb(params: {
  organizationId: string;
  campaignId: string;
  autopilotEnabled: boolean;
}): Promise<Record<string, unknown>> {
  const admin = createSupabaseAdminClient();
  const { data: camp, error: cErr } = await admin
    .from("campaigns" as never)
    .select("name,metadata")
    .eq("organization_id", params.organizationId)
    .eq("id", params.campaignId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);

  const meta = asMetadataRecord((camp as { metadata?: unknown } | null)?.metadata);
  const ge = asMetadataRecord(meta.growth_engine);
  const funnelSummary = (ge.funnel_visualization as Record<string, unknown> | undefined) ?? null;

  const { data: events, error: eErr } = await admin
    .from("ad_performance_events" as never)
    .select("ad_id,platform,impressions,clicks,spend,leads,conversions,ctr,cpl,captured_at")
    .eq("organization_id", params.organizationId)
    .eq("campaign_id", params.campaignId)
    .order("captured_at", { ascending: false })
    .limit(200);
  if (eErr) throw new Error(eErr.message);

  const name = typeof (camp as { name?: unknown } | null)?.name === "string" ? String((camp as { name?: string }).name) : params.campaignId;

  return runOptimizationEngine({
    campaignName: name,
    autopilotEnabled: params.autopilotEnabled,
    metrics: { ad_performance_events: events ?? [] },
    funnelSummary,
  });
}
