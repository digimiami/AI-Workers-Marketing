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
  const { data: run } = await admin
    .from("agent_runs" as never)
    .select("input")
    .eq("organization_id", parsedOrg.data)
    .eq("id", parsedRun.data)
    .maybeSingle();

  const traceId = String((run as any)?.input?.trace_id ?? "");
  if (!traceId) {
    return NextResponse.json({ ok: true, toolCalls: [] });
  }

  const { data: toolCalls } = await admin
    .from("openclaw_tool_calls" as never)
    .select("id,created_at,tool_name,ok,error_code,error_message,approval_required,approval_id,input,output")
    .eq("organization_id", parsedOrg.data)
    .eq("trace_id", traceId)
    .order("created_at", { ascending: true })
    .limit(500);

  return NextResponse.json({ ok: true, toolCalls: toolCalls ?? [], traceId });
}

