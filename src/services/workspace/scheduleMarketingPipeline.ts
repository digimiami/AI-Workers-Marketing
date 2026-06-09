import { after } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runMarketingPipeline } from "@/services/marketing-pipeline/runMarketingPipeline";
import type { RunMarketingPipelineInput } from "@/services/marketing-pipeline/types";

const IN_FLIGHT_MS = 45_000;

export type SchedulePipelineResult =
  | { scheduled: true; reason: "run" | "retry" }
  | { scheduled: false; reason: "not_found" | "done" | "in_flight" };

/** Queue pipeline work after the HTTP response (build-start / pipeline-execute). */
export async function scheduleMarketingPipelineResume(params: {
  supabase: SupabaseClient;
  actorUserId: string;
  organizationId: string;
  pipelineRunId: string;
  force?: boolean;
}): Promise<SchedulePipelineResult> {
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("marketing_pipeline_runs" as never)
    .select("status,updated_at")
    .eq("id", params.pipelineRunId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (!row) return { scheduled: false, reason: "not_found" };

  const status = String((row as { status?: string }).status ?? "");
  if (status === "completed" || status === "needs_approval") {
    return { scheduled: false, reason: "done" };
  }

  if (!params.force) {
    const updatedAt = new Date(String((row as { updated_at?: string }).updated_at ?? 0)).getTime();
    if (status === "running" && Date.now() - updatedAt < IN_FLIGHT_MS) {
      return { scheduled: false, reason: "in_flight" };
    }
  }

  after(async () => {
    try {
      await runMarketingPipeline({
        supabase: params.supabase,
        actorUserId: params.actorUserId,
        input: {
          organizationMode: "existing",
          organizationId: params.organizationId,
          resumePipelineRunId: params.pipelineRunId,
        } as RunMarketingPipelineInput,
      });
    } catch (e) {
      console.error("[pipeline] scheduled run failed", e);
    }
  });

  return { scheduled: true, reason: status === "failed" ? "retry" : "run" };
}
