import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  ctx: { params: Promise<unknown> },
) {
  const params = (await ctx.params) as { runId?: unknown };
  const runId = typeof params?.runId === "string" ? params.runId : "";
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsedOrg = z.string().uuid().safeParse(organizationId);
  const parsedRun = z.string().uuid().safeParse(runId);
  if (!parsedOrg.success || !parsedRun.success) {
    return NextResponse.json({ ok: false, message: "organizationId and runId required" }, { status: 400 });
  }

  const orgCtx = await withOrgMember(parsedOrg.data);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();

  const { data: run, error: runErr } = await admin
    .from("agent_runs" as never)
    .select("id,status,input,output_summary,error_message,created_at,started_at,finished_at,campaign_id,agent_id")
    .eq("organization_id", parsedOrg.data)
    .eq("id", parsedRun.data)
    .single();
  if (runErr || !run) {
    return NextResponse.json({ ok: false, message: "Run not found" }, { status: 404 });
  }

  const traceId = String((run as any).input?.trace_id ?? "");

  const { data: outputs } = await admin
    .from("agent_outputs" as never)
    .select("id,output_type,content,created_at")
    .eq("organization_id", parsedOrg.data)
    .eq("run_id", parsedRun.data)
    .order("created_at", { ascending: false })
    .limit(20);
  const reviewRow = (outputs ?? []).find((o: any) => o.output_type === "launch.review") as any;

  const { data: toolCalls } = traceId
    ? await admin
        .from("openclaw_tool_calls" as never)
        .select("id,created_at,tool_name,ok,error_code")
        .eq("organization_id", parsedOrg.data)
        .eq("trace_id", traceId)
        .order("created_at", { ascending: true })
        .limit(500)
    : { data: [] as any[] };

  const { data: runLogs } = await admin
    .from("agent_logs" as never)
    .select("id,created_at,level,message")
    .eq("organization_id", parsedOrg.data)
    .eq("run_id", parsedRun.data)
    .order("created_at", { ascending: true })
    .limit(500);

  return NextResponse.json({
    ok: true,
    run,
    traceId,
    review: reviewRow?.content ?? null,
    toolCalls: toolCalls ?? [],
    runLogs: runLogs ?? [],
  });
}

