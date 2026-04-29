import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";

export async function GET(request: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsedOrg = z.string().uuid().safeParse(organizationId);
  const parsedRun = z.string().uuid().safeParse(runId);
  if (!parsedOrg.success || !parsedRun.success) {
    return NextResponse.json({ ok: false, message: "organizationId and runId required" }, { status: 400 });
  }

  const orgCtx = await withOrgMember(parsedOrg.data);
  if (orgCtx.error) return orgCtx.error;

  const { data: run } = await orgCtx.supabase
    .from("agent_runs" as never)
    .select("id,status,output_summary,error_message,created_at")
    .eq("organization_id", parsedOrg.data)
    .eq("id", parsedRun.data)
    .maybeSingle();

  const { data: logs } = await orgCtx.supabase
    .from("agent_logs" as never)
    .select("id,created_at,level,message")
    .eq("organization_id", parsedOrg.data)
    .eq("run_id", parsedRun.data)
    .order("created_at", { ascending: true })
    .limit(300);

  const { data: outputs } = await orgCtx.supabase
    .from("agent_outputs" as never)
    .select("id,output_type,content,created_at")
    .eq("organization_id", parsedOrg.data)
    .eq("run_id", parsedRun.data)
    .order("created_at", { ascending: true })
    .limit(50);

  const { data: approvals } = await orgCtx.supabase
    .from("approvals" as never)
    .select("id,status,approval_type,created_at")
    .eq("organization_id", parsedOrg.data)
    .eq("agent_run_id", parsedRun.data)
    .order("created_at", { ascending: false })
    .limit(50);

  const asRows = <T>(v: unknown): T[] => (Array.isArray(v) ? v : []);

  return NextResponse.json({
    ok: true,
    run: run ?? null,
    logs: asRows(logs),
    outputs: asRows(outputs),
    approvals: asRows(approvals),
  });
}

