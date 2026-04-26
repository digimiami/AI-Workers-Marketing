import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";

const qSchema = z.object({ organizationId: z.string().uuid() });

export async function GET(request: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  if (!z.string().uuid().safeParse(campaignId).success) {
    return NextResponse.json({ ok: false, message: "Invalid campaignId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsed = qSchema.safeParse({ organizationId: url.searchParams.get("organizationId") });
  if (!parsed.success) return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });

  const ctxOrg = await withOrgMember(parsed.data.organizationId);
  if (ctxOrg.error) return ctxOrg.error;

  const orgId = parsed.data.organizationId;

  const [campaign, funnel, steps, content, templates, sequences, seqSteps, agents, approvals, logs, toolCalls] =
    await Promise.all([
      ctxOrg.supabase
        .from("campaigns" as never)
        .select("*")
        .eq("organization_id", orgId)
        .eq("id", campaignId)
        .maybeSingle(),
      ctxOrg.supabase
        .from("funnels" as never)
        .select("*")
        .eq("organization_id", orgId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      ctxOrg.supabase
        .from("funnel_steps" as never)
        .select("id,funnel_id,step_index,name,step_type,slug,metadata,created_at,updated_at")
        .eq("organization_id", orgId)
        .order("step_index", { ascending: true })
        .limit(200),
      ctxOrg.supabase
        .from("content_assets" as never)
        .select("id,title,status,platform,campaign_id,funnel_id,created_at,updated_at")
        .eq("organization_id", orgId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(200),
      ctxOrg.supabase
        .from("email_templates" as never)
        .select("id,name,subject,created_at,updated_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200),
      ctxOrg.supabase
        .from("email_sequences" as never)
        .select("id,name,description,is_active,metadata,created_at,updated_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),
      ctxOrg.supabase
        .from("email_sequence_steps" as never)
        .select("id,sequence_id,step_index,delay_minutes,template_id,created_at,updated_at")
        .eq("organization_id", orgId)
        .order("step_index", { ascending: true })
        .limit(400),
      ctxOrg.supabase
        .from("campaign_agents" as never)
        .select("id,priority,config,agents(id,key,name,status,approval_required,last_run_at)")
        .eq("organization_id", orgId)
        .eq("campaign_id", campaignId)
        .order("priority", { ascending: true })
        .limit(50),
      ctxOrg.supabase
        .from("approvals" as never)
        .select("id,approval_type,status,created_at,updated_at,campaign_id,agent_run_id")
        .eq("organization_id", orgId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(200),
      ctxOrg.supabase
        .from("agent_logs" as never)
        .select("id,run_id,level,message,data,created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200),
      ctxOrg.supabase
        .from("openclaw_tool_calls" as never)
        .select("id,tool_name,ok,error_code,created_at,trace_id,run_id,campaign_id")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  if (campaign.error) return NextResponse.json({ ok: false, message: campaign.error.message }, { status: 500 });
  if (!campaign.data) return NextResponse.json({ ok: false, message: "Campaign not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    campaign: campaign.data,
    funnel: funnel.data ?? null,
    funnel_steps: steps.data ?? [],
    content_assets: content.data ?? [],
    email_templates: templates.data ?? [],
    email_sequences: sequences.data ?? [],
    email_sequence_steps: seqSteps.data ?? [],
    worker_assignments: agents.data ?? [],
    approvals: approvals.data ?? [],
    logs: logs.data ?? [],
    tool_calls: toolCalls.data ?? [],
  });
}

