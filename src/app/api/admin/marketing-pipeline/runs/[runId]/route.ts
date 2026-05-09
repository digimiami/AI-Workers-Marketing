import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildRunTimeline,
  fetchWorkspaceDisplayBundle,
  type PipelineRunSnapshot,
} from "@/services/workspace/workspaceDisplayBundle";

const paramsSchema = z.object({ runId: z.string().uuid() });

function asRows<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export async function GET(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  const params = await ctx.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid runId" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: run, error: runErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .select("id,organization_id,campaign_id,provider,approval_mode,status,current_stage,started_at,finished_at,warnings,errors,input,created_at,updated_at")
    .eq("id", parsed.data.runId)
    .maybeSingle();
  if (runErr) return NextResponse.json({ ok: false, message: runErr.message }, { status: 500 });
  if (!run) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  const orgCtx = await withOrgMember(String((run as any).organization_id));
  if (orgCtx.error) return orgCtx.error;

  const { data: stages } = await admin
    .from("marketing_pipeline_stages" as never)
    .select("id,stage_key,status,assigned_workers,started_at,finished_at,output_summary,error_message,created_at,updated_at")
    .eq("pipeline_run_id", parsed.data.runId)
    .order("created_at", { ascending: true });

  const stageIds = new Set((stages ?? []).map((s: any) => String(s.id)));
  const { data: outputs } = await admin
    .from("marketing_pipeline_stage_outputs" as never)
    .select("id,stage_id,output_type,content,created_record_refs,created_at")
    .eq("pipeline_run_id", parsed.data.runId)
    .order("created_at", { ascending: true })
    .limit(200);

  const { data: logs } = await admin
    .from("marketing_pipeline_stage_logs" as never)
    .select("id,stage_id,level,message,data,created_at")
    .eq("pipeline_run_id", parsed.data.runId)
    .order("created_at", { ascending: true })
    .limit(400);

  const { data: workerOutputs } = await admin
    .from("ai_worker_skill_outputs" as never)
    .select("id,stage_id,skill_key,status,output,provider,created_at")
    .eq("pipeline_run_id", parsed.data.runId)
    .order("created_at", { ascending: true })
    .limit(400);

  // Pipeline approvals (created in Stage 4 with payload.pipeline_run_id)
  const { data: approvals } = await admin
    .from("approvals" as never)
    .select("id,status,approval_type,payload,created_at,campaign_id")
    .eq("organization_id", String((run as any).organization_id))
    .eq("campaign_id", (run as any).campaign_id ?? null)
    .order("created_at", { ascending: false })
    .limit(200);
  const pipelineApprovals = (approvals ?? []).filter((a: any) => String(a?.payload?.pipeline_run_id ?? "") === parsed.data.runId);

  // Normalize
  const runObj = (run as any) as Record<string, unknown>;
  const out = {
    ...runObj,
    warnings: asRows<string>((runObj as any).warnings),
    errors: asRows<string>((runObj as any).errors),
    stages: asRows<any>(stages),
    outputs: asRows<any>(outputs).filter((o) => stageIds.size === 0 || stageIds.has(String((o as any).stage_id))),
    logs: asRows<any>(logs),
    workerOutputs: asRows<any>(workerOutputs),
    approvals: asRows<any>(pipelineApprovals),
  };

  const orgId = String((run as any).organization_id);
  const campaignId = (run as any).campaign_id ? String((run as any).campaign_id) : null;

  let workspaceDisplay: Awaited<ReturnType<typeof fetchWorkspaceDisplayBundle>> | null = null;
  if (campaignId) {
    workspaceDisplay = await fetchWorkspaceDisplayBundle(admin, orgId, campaignId);
  }

  const stageRows = asRows<any>(stages);
  const snapshot: PipelineRunSnapshot = {
    status: String((run as any).status ?? "pending"),
    current_stage: (run as any).current_stage ? String((run as any).current_stage) : null,
    stages: stageRows.map((s: any) => ({
      stage_key: String(s.stage_key ?? ""),
      status: String(s.status ?? "pending"),
      output_summary: s.output_summary ?? null,
      error_message: s.error_message ?? null,
    })),
    logs: asRows<any>(logs).map((l: any) => ({
      id: String(l.id),
      level: String(l.level ?? "info"),
      message: String(l.message ?? ""),
      created_at: String(l.created_at ?? ""),
      stage_id: l.stage_id ? String(l.stage_id) : null,
    })),
  };

  const runTimeline = buildRunTimeline(snapshot, workspaceDisplay);

  return NextResponse.json({
    ok: true,
    run: out,
    workspaceDisplay,
    runTimeline,
  });
}

/** Remove a saved pipeline run and all cascaded stage data (org members, same auth as GET). */
export async function DELETE(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  const params = await ctx.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid runId" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: run, error: runErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .select("id,organization_id")
    .eq("id", parsed.data.runId)
    .maybeSingle();
  if (runErr) return NextResponse.json({ ok: false, message: runErr.message }, { status: 500 });
  if (!run) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  const orgCtx = await withOrgMember(String((run as { organization_id?: string }).organization_id));
  if (orgCtx.error) return orgCtx.error;

  const orgId = String((run as { organization_id?: string }).organization_id);
  const { error: delErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .delete()
    .eq("id", parsed.data.runId)
    .eq("organization_id", orgId);

  if (delErr) return NextResponse.json({ ok: false, message: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
