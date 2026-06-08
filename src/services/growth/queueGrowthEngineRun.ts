import { after } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runAiGrowthEngine, type RunAiGrowthEngineInput } from "@/services/growth/growthEngine";

export async function markCampaignGrowthStatus(params: {
  organizationId: string;
  campaignId: string;
  status: "building" | "failed";
  error?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("campaigns" as never)
    .select("metadata")
    .eq("organization_id", params.organizationId)
    .eq("id", params.campaignId)
    .maybeSingle();
  const prevMeta = asMetadataRecord((row as { metadata?: unknown } | null)?.metadata);
  const patch =
    params.status === "building"
      ? { growth_engine: { status: "building", started_at: new Date().toISOString() } }
      : {
          growth_engine: {
            status: "failed",
            failed_at: new Date().toISOString(),
            error: params.error ?? "Growth engine failed",
          },
        };
  await admin
    .from("campaigns" as never)
    .update({ metadata: mergeJsonbRecords(prevMeta, patch), updated_at: new Date().toISOString() } as never)
    .eq("organization_id", params.organizationId)
    .eq("id", params.campaignId);
}

export async function queueDeferredGrowthEngine(params: {
  supabase: SupabaseClient;
  actorUserId: string;
  organizationId: string;
  campaignId?: string | null;
  input: RunAiGrowthEngineInput;
}) {
  if (params.campaignId) {
    try {
      await markCampaignGrowthStatus({
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        status: "building",
      });
    } catch (e) {
      console.error("[growth] failed to mark campaign building", e);
    }
  }

  after(async () => {
    try {
      await runAiGrowthEngine({
        supabase: params.supabase,
        actorUserId: params.actorUserId,
        input: params.input,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Growth engine failed";
      console.error("[growth] deferred execution failed", e);
      if (params.campaignId) {
        try {
          await markCampaignGrowthStatus({
            organizationId: params.organizationId,
            campaignId: params.campaignId,
            status: "failed",
            error: msg,
          });
        } catch (markErr) {
          console.error("[growth] failed to mark campaign failed", markErr);
        }
      }
    }
  });
}
