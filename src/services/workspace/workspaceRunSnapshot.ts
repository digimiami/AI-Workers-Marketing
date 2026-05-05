import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildRunTimeline, fetchWorkspaceDisplayBundle } from "@/services/workspace/workspaceDisplayBundle";

function asRows<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function normalizeWorkspaceStreamUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/** Server-safe snapshot for marketing pipeline runs (admin client only — safe to import from client bundles that only call HTTP APIs elsewhere). */
export async function fetchWorkspaceRunSnapshot(admin: ReturnType<typeof createSupabaseAdminClient>, runId: string) {
  const { data: run, error: runErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .select(
      "id,organization_id,campaign_id,provider,approval_mode,status,current_stage,started_at,finished_at,warnings,errors,input,created_at,updated_at",
    )
    .eq("id", runId)
    .maybeSingle();
  if (runErr) throw new Error(runErr.message);
  if (!run) throw new Error("Run not found");

  const { data: stages } = await admin
    .from("marketing_pipeline_stages" as never)
    .select("id,stage_key,status,started_at,finished_at,output_summary,error_message,created_at,updated_at")
    .eq("pipeline_run_id", runId)
    .order("created_at", { ascending: true });

  const { data: outputs } = await admin
    .from("marketing_pipeline_stage_outputs" as never)
    .select("id,stage_id,output_type,content,created_record_refs,created_at")
    .eq("pipeline_run_id", runId)
    .order("created_at", { ascending: true })
    .limit(200);

  const { data: logs } = await admin
    .from("marketing_pipeline_stage_logs" as never)
    .select("id,stage_id,level,message,data,created_at")
    .eq("pipeline_run_id", runId)
    .order("created_at", { ascending: true })
    .limit(400);

  const { data: workerOutputs } = await admin
    .from("ai_worker_skill_outputs" as never)
    .select("id,stage_id,skill_key,status,output,provider,created_at")
    .eq("pipeline_run_id", runId)
    .order("created_at", { ascending: true })
    .limit(400);

  const orgId = String((run as { organization_id: string }).organization_id);
  const campaignId = (run as { campaign_id?: string | null }).campaign_id ? String((run as { campaign_id?: string | null }).campaign_id) : null;

  let workspaceDisplay: Awaited<ReturnType<typeof fetchWorkspaceDisplayBundle>> | null = null;
  if (campaignId) {
    workspaceDisplay = await fetchWorkspaceDisplayBundle(admin, orgId, campaignId);
  }

  const snapshot = {
    status: String((run as { status?: string }).status ?? "pending"),
    current_stage: (run as { current_stage?: string | null }).current_stage
      ? String((run as { current_stage?: string | null }).current_stage)
      : null,
    stages: asRows<{ stage_key?: string; status?: string; output_summary?: unknown; error_message?: unknown }>(stages).map((s) => ({
      stage_key: String(s.stage_key ?? ""),
      status: String(s.status ?? "pending"),
      output_summary: s.output_summary ?? null,
      error_message: s.error_message ?? null,
    })),
    logs: asRows<{ id?: string; level?: string; message?: string; created_at?: string; stage_id?: string | null }>(logs).map((l) => ({
      id: String(l.id),
      level: String(l.level ?? "info"),
      message: String(l.message ?? ""),
      created_at: String(l.created_at ?? ""),
      stage_id: l.stage_id ? String(l.stage_id) : null,
    })),
  };

  const runTimeline = buildRunTimeline(snapshot as never, workspaceDisplay);

  return {
    run: run as Record<string, unknown>,
    stages: asRows<Record<string, unknown>>(stages),
    outputs: asRows<Record<string, unknown>>(outputs),
    logs: asRows<Record<string, unknown>>(logs),
    workerOutputs: asRows<Record<string, unknown>>(workerOutputs),
    workspaceDisplay,
    runTimeline,
  };
}
