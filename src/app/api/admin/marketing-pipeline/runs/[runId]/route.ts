import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  };

  return NextResponse.json({ ok: true, run: out });
}

