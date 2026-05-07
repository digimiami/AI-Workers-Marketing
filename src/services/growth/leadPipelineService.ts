import type { SupabaseClient } from "@supabase/supabase-js";

import { buildLeadPipelineUserPrompt, LEAD_PIPELINE_SYSTEM } from "@/ai/prompts/lead_pipeline.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

const DEFAULT_STAGE_NAMES = ["new_lead", "engaged", "hot", "booked", "converted", "lost"] as const;

export async function ensureDefaultLeadPipelineStages(admin: SupabaseClient, organizationId: string) {
  const { count, error: cErr } = await admin
    .from("lead_pipeline_stages" as never)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) > 0) return;

  const rows = DEFAULT_STAGE_NAMES.map((name, idx) => ({
    organization_id: organizationId,
    name,
    sort_order: idx,
    metadata: { system: true },
  }));
  const { error } = await admin.from("lead_pipeline_stages" as never).insert(rows as never);
  if (error) throw new Error(error.message);
}

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function scoreLeadWithAi(input: {
  lead: Record<string, unknown>;
  campaign: Record<string, unknown> | null;
  recentEvents: Array<Record<string, unknown>>;
}): Promise<Record<string, unknown>> {
  const fallbackJsonText = JSON.stringify({
    stage: "new_lead",
    score: 10,
    intentLevel: "low",
    nextBestAction: "Send value-first follow-up and confirm intent.",
    automationTrigger: "nurture_day_0",
    notes: "Limited behavioral data — conservative score.",
  });

  const out = await runStrictJsonPrompt({
    system: LEAD_PIPELINE_SYSTEM,
    user: buildLeadPipelineUserPrompt({
      lead: input.lead,
      campaign: input.campaign,
      recentEvents: input.recentEvents,
    }),
    fallbackJsonText,
  });
  return safeParseRecord(out.jsonText);
}
