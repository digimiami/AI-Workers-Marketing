import type { SupabaseClient } from "@supabase/supabase-js";

import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { pipelineRunInputToLiveBuild } from "@/services/workspace/pipelineRunInput";

export type CampaignBuildFields = {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
};

function pickField(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const v = typeof c === "string" ? c.trim() : "";
    if (v) return v;
  }
  return "";
}

/** Merge campaign metadata, growth_engine, pipeline run input, and request overrides. */
export function buildFieldsFromRecords(params: {
  meta?: Record<string, unknown>;
  pipelineInput?: unknown;
  overrides?: Partial<CampaignBuildFields>;
}): CampaignBuildFields {
  const meta = params.meta ?? {};
  const ge = asMetadataRecord(meta.growth_engine);
  const fromPipeline = pipelineRunInputToLiveBuild(params.pipelineInput);
  const o = params.overrides ?? {};

  return {
    url: pickField(o.url, typeof meta.url === "string" ? meta.url : undefined, fromPipeline?.url),
    goal: pickField(o.goal, typeof meta.goal === "string" ? meta.goal : undefined, fromPipeline?.goal),
    audience: pickField(
      o.audience,
      typeof meta.audience === "string" ? meta.audience : undefined,
      fromPipeline?.audience,
    ),
    trafficSource: pickField(
      o.trafficSource,
      typeof meta.traffic_source === "string" ? meta.traffic_source : undefined,
      typeof ge.traffic_source === "string" ? ge.traffic_source : undefined,
      fromPipeline?.trafficSource,
    ),
  };
}

/** Resolve url/goal/audience/trafficSource for a campaign (metadata + latest pipeline run). */
export async function resolveCampaignBuildFields(
  admin: SupabaseClient,
  organizationId: string,
  campaignId: string,
  overrides?: Partial<CampaignBuildFields>,
): Promise<CampaignBuildFields> {
  const { data: campRow } = await admin
    .from("campaigns" as never)
    .select("metadata")
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle();

  const { data: runRow } = await admin
    .from("marketing_pipeline_runs" as never)
    .select("input")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return buildFieldsFromRecords({
    meta: asMetadataRecord((campRow as { metadata?: unknown } | null)?.metadata),
    pipelineInput: (runRow as { input?: unknown } | null)?.input,
    overrides,
  });
}

/** Persist build context on campaign metadata so landing regen does not depend on pipeline rows. */
export async function syncCampaignBuildMetadata(
  admin: SupabaseClient,
  organizationId: string,
  campaignId: string,
  fields: CampaignBuildFields,
): Promise<void> {
  if (!fields.url || !fields.goal || !fields.audience || !fields.trafficSource) return;
  try {
    const { data: camp } = await admin
      .from("campaigns" as never)
      .select("metadata")
      .eq("organization_id", organizationId)
      .eq("id", campaignId)
      .maybeSingle();
    const prev = asMetadataRecord((camp as { metadata?: unknown } | null)?.metadata);
    const next = mergeJsonbRecords(prev, {
      url: fields.url,
      goal: fields.goal,
      audience: fields.audience,
      traffic_source: fields.trafficSource,
    });
    await admin
      .from("campaigns" as never)
      .update({ metadata: next, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", organizationId)
      .eq("id", campaignId);
  } catch {
    // best-effort
  }
}
