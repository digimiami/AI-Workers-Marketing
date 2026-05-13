import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { runGrowthOptimizationFromDb } from "@/services/growth/optimizationEngineService";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * One pass of the diagram’s “AI Optimization Loop”: collect on-site + ad metrics,
 * run the optimization JSON prompt with enriched context, persist a cycle record on the campaign.
 * Does not auto-mutate ads or budgets; use approvals + existing launch flows for execution.
 */
export async function runGrowthOptimizationLoopCycle(params: {
  organizationId: string;
  campaignId: string;
  autopilotEnabled: boolean;
}): Promise<{ cycle: Record<string, unknown>; optimization: Record<string, unknown> }> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();

  const [{ data: events }, { data: camp }] = await Promise.all([
    admin
      .from("analytics_events" as never)
      .select("event_name,metadata,created_at")
      .eq("organization_id", params.organizationId)
      .eq("campaign_id", params.campaignId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2500),
    admin.from("campaigns" as never).select("metadata").eq("organization_id", params.organizationId).eq("id", params.campaignId).maybeSingle(),
  ]);

  const rows = (events ?? []) as Array<{ event_name: string; metadata?: unknown }>;
  const byEvent: Record<string, number> = {};
  const variantViews: Record<string, number> = {};
  for (const r of rows) {
    const n = String(r.event_name ?? "unknown");
    byEvent[n] = (byEvent[n] ?? 0) + 1;
    if (n === "page_view") {
      const md = asRecord(r.metadata);
      const vk = typeof md.variant_key === "string" ? md.variant_key : "";
      if (vk) variantViews[vk] = (variantViews[vk] ?? 0) + 1;
    }
  }

  const meta = asMetadataRecord((camp as { metadata?: unknown } | null)?.metadata);
  const ge = asMetadataRecord(meta.growth_engine);
  const variantScoring = ge.variant_scoring ?? null;

  const additionalMetrics = {
    analytics_window_days: 30,
    analytics_event_totals: byEvent,
    landing_variant_page_views: variantViews,
    prelaunch_variant_scoring: variantScoring,
  };

  const optimization = await runGrowthOptimizationFromDb({
    organizationId: params.organizationId,
    campaignId: params.campaignId,
    autopilotEnabled: params.autopilotEnabled,
    additionalMetrics,
  });

  const recs = Array.isArray(optimization.recommendations) ? (optimization.recommendations as unknown[]) : [];
  const acts = Array.isArray(optimization.suggestedActions) ? (optimization.suggestedActions as unknown[]) : [];

  const cycle = {
    at: new Date().toISOString(),
    collected: {
      events_sampled: rows.length,
      event_totals: byEvent,
      variant_page_views: variantViews,
    },
    analysis: {
      summary: typeof optimization.summary === "string" ? optimization.summary : "",
      winners: Array.isArray(optimization.winners) ? optimization.winners : [],
      losers: Array.isArray(optimization.losers) ? optimization.losers : [],
    },
    decisions: {
      top_recommendations: recs.slice(0, 6),
    },
    actions: {
      suggested: acts.slice(0, 10),
    },
  };

  const prevCycles = Array.isArray(ge.optimization_loop_cycles) ? [...(ge.optimization_loop_cycles as unknown[])] : [];
  prevCycles.push(cycle);
  const trimmed = prevCycles.slice(-20);

  const nextMeta = mergeJsonbRecords(meta, {
    growth_engine: {
      ...ge,
      optimization_loop_cycles: trimmed,
      optimization_last_cycle_at: cycle.at,
    },
  });

  await admin
    .from("campaigns" as never)
    .update({ metadata: nextMeta, updated_at: new Date().toISOString() } as never)
    .eq("organization_id", params.organizationId)
    .eq("id", params.campaignId);

  return { cycle, optimization };
}
