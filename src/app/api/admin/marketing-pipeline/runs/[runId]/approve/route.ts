import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decideApproval } from "@/services/openclaw/orchestrationService";

const paramsSchema = z.object({ runId: z.string().uuid() });

export async function POST(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  const params = await ctx.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid runId" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: run, error: runErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .select("id,organization_id,campaign_id,status")
    .eq("id", parsed.data.runId)
    .maybeSingle();
  if (runErr) return NextResponse.json({ ok: false, message: runErr.message }, { status: 500 });
  if (!run) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  const organizationId = String((run as any).organization_id);
  const campaignId = (run as any).campaign_id ? String((run as any).campaign_id) : null;

  const orgCtx = await withOrgOperator(organizationId);
  if (orgCtx.error) return orgCtx.error;

  // Find pipeline approvals by payload.pipeline_run_id
  const { data: approvals, error: aErr } = await admin
    .from("approvals" as never)
    .select("id,status,approval_type,payload")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (aErr) return NextResponse.json({ ok: false, message: aErr.message }, { status: 500 });

  const pipelineApprovals = (approvals ?? []).filter((a: any) => String(a?.payload?.pipeline_run_id ?? "") === parsed.data.runId);
  const pending = pipelineApprovals.filter((a: any) => String(a.status) === "pending");

  // Decide approvals (this also applies review_status/is_active side-effects for supported targets)
  const decided: Array<{ id: string; approval_type: string }> = [];
  for (const a of pending as any[]) {
    await decideApproval(orgCtx.supabase, organizationId, String(a.id), orgCtx.user.id, "approved");
    decided.push({ id: String(a.id), approval_type: String(a.approval_type ?? "") });
  }

  // Extra pipeline side-effects (best effort):
  // - publish timestamps for pages
  // - activate email sequence (if known in approval payload)
  const emailApproval = pending.find((a: any) => String(a.approval_type) === "email_sending");
  const sequenceId = typeof (emailApproval as any)?.payload?.sequence_id === "string" ? String((emailApproval as any).payload.sequence_id) : null;
  if (sequenceId) {
    await admin
      .from("email_sequences" as never)
      .update({ is_active: true, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", organizationId)
      .eq("id", sequenceId);
  }

  if (campaignId) {
    // mark creatives approved
    await admin
      .from("ad_creatives" as never)
      .update({ status: "approved", updated_at: new Date().toISOString() } as never)
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .eq("status", "draft");
  }

  // publish pages for campaign funnel (if resolvable)
  if (campaignId) {
    const { data: funnel } = await admin
      .from("funnels" as never)
      .select("id")
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .maybeSingle();
    const funnelId = funnel ? String((funnel as any).id) : null;
    if (funnelId) {
      const { data: steps } = await admin
        .from("funnel_steps" as never)
        .select("id,step_type")
        .eq("organization_id", organizationId)
        .eq("funnel_id", funnelId)
        .limit(50);
      const srows = (steps ?? []) as any[];
      const landingStepId = srows.find((s) => String(s.step_type) === "landing")?.id ? String(srows.find((s) => String(s.step_type) === "landing")!.id) : null;
      const bridgeStepId = srows.find((s) => String(s.step_type) === "bridge")?.id ? String(srows.find((s) => String(s.step_type) === "bridge")!.id) : null;
      if (landingStepId) {
        await admin
          .from("landing_pages" as never)
          .update({ published_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
          .eq("organization_id", organizationId)
          .eq("funnel_step_id", landingStepId);
      }
      if (bridgeStepId) {
        await admin
          .from("bridge_pages" as never)
          .update({ published_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
          .eq("organization_id", organizationId)
          .eq("funnel_step_id", bridgeStepId);
      }
    }
  }

  // Update pipeline stage/run statuses to completed (if they were waiting)
  await admin
    .from("marketing_pipeline_stages" as never)
    .update({ status: "completed", updated_at: new Date().toISOString(), finished_at: new Date().toISOString() } as never)
    .eq("organization_id", organizationId)
    .eq("pipeline_run_id", parsed.data.runId)
    .eq("stage_key", "execution")
    .eq("status", "needs_approval");

  await admin
    .from("marketing_pipeline_runs" as never)
    .update({ status: "completed", updated_at: new Date().toISOString(), finished_at: new Date().toISOString() } as never)
    .eq("organization_id", organizationId)
    .eq("id", parsed.data.runId)
    .in("status", ["needs_approval", "running"] as never);

  return NextResponse.json({ ok: true, decided_count: decided.length, decided });
}

