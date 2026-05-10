import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  ctx: { params: Promise<unknown> },
) {
  const params = (await ctx.params) as { approvalId?: unknown };
  const approvalId = typeof params?.approvalId === "string" ? params.approvalId : "";
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const pOrg = z.string().uuid().safeParse(organizationId);
  const pAppr = z.string().uuid().safeParse(approvalId);
  if (!pOrg.success || !pAppr.success) {
    return NextResponse.json({ ok: false, message: "organizationId and approvalId required" }, { status: 400 });
  }

  const orgCtx = await withOrgMember(pOrg.data);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const { data: approval, error } = await admin
    .from("approvals" as never)
    .select("*")
    .eq("organization_id", pOrg.data)
    .eq("id", pAppr.data)
    .single();
  if (error || !approval) {
    return NextResponse.json({ ok: false, message: "Approval not found" }, { status: 404 });
  }

  const runId = (approval as any).agent_run_id as string | null;
  const campaignId = (approval as any).campaign_id as string | null;
  const targetType = (approval as any).target_entity_type as string | null;
  const targetId = (approval as any).target_entity_id as string | null;

  const { data: run } = runId
    ? await admin
        .from("agent_runs" as never)
        .select("id,status,input,output_summary,error_message,created_at,campaign_id,agents(key,name)")
        .eq("organization_id", pOrg.data)
        .eq("id", runId)
        .maybeSingle()
    : { data: null };

  const { data: outputs } = runId
    ? await admin
        .from("agent_outputs" as never)
        .select("id,output_type,content,created_at")
        .eq("organization_id", pOrg.data)
        .eq("run_id", runId)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] as any[] };

  const { data: campaign } = campaignId
    ? await admin
        .from("campaigns" as never)
        .select("id,name,status,type")
        .eq("organization_id", pOrg.data)
        .eq("id", campaignId)
        .maybeSingle()
    : { data: null };

  const targetRow = await (async () => {
    if (!targetType || !targetId) return null;
    if (targetType === "content_asset") {
      const { data } = await admin
        .from("content_assets" as never)
        .select("id,title,status,review_status,campaign_id,funnel_id")
        .eq("organization_id", pOrg.data)
        .eq("id", targetId)
        .maybeSingle();
      return data ?? null;
    }
    if (targetType === "email_template") {
      const { data } = await admin
        .from("email_templates" as never)
        .select("id,name,subject,status,review_status")
        .eq("organization_id", pOrg.data)
        .eq("id", targetId)
        .maybeSingle();
      return data ?? null;
    }
    if (targetType === "email_sequence") {
      const { data } = await admin
        .from("email_sequences" as never)
        .select("id,name,is_active,review_status")
        .eq("organization_id", pOrg.data)
        .eq("id", targetId)
        .maybeSingle();
      return data ?? null;
    }
    if (targetType === "affiliate_link") {
      const { data } = await admin
        .from("affiliate_links" as never)
        .select("id,label,destination_url,is_active,review_status,campaign_id")
        .eq("organization_id", pOrg.data)
        .eq("id", targetId)
        .maybeSingle();
      return data ?? null;
    }
    return null;
  })();

  return NextResponse.json({
    ok: true,
    approval,
    campaign,
    run,
    outputs: outputs ?? [],
    target: targetRow,
  });
}

const patchApprovalBody = z.object({
  organizationId: z.string().uuid(),
  operator_note: z.string().max(4000).optional(),
});

const deleteApprovalBody = z.object({
  organizationId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ approvalId?: unknown }> },
) {
  const params = (await ctx.params) as { approvalId?: unknown };
  const approvalId = typeof params?.approvalId === "string" ? params.approvalId : "";
  const pAppr = z.string().uuid().safeParse(approvalId);
  if (!pAppr.success) {
    return NextResponse.json({ ok: false, message: "Invalid approvalId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchApprovalBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const { data: existing, error: loadErr } = await op.supabase
    .from("approvals" as never)
    .select("id,payload")
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", pAppr.data)
    .maybeSingle();
  if (loadErr || !existing) {
    return NextResponse.json({ ok: false, message: "Approval not found" }, { status: 404 });
  }

  const prevPayload =
    (existing as { payload?: unknown }).payload && typeof (existing as { payload?: unknown }).payload === "object"
      ? ((existing as { payload: Record<string, unknown> }).payload as Record<string, unknown>)
      : {};
  const nextPayload = {
    ...prevPayload,
    ...(parsed.data.operator_note !== undefined
      ? { operator_note: parsed.data.operator_note }
      : {}),
  };

  const { error } = await op.supabase
    .from("approvals" as never)
    .update({ payload: nextPayload as never } as never)
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", pAppr.data);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ approvalId?: unknown }> },
) {
  const params = (await ctx.params) as { approvalId?: unknown };
  const approvalId = typeof params?.approvalId === "string" ? params.approvalId : "";
  const pAppr = z.string().uuid().safeParse(approvalId);
  if (!pAppr.success) {
    return NextResponse.json({ ok: false, message: "Invalid approvalId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteApprovalBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const { error } = await op.supabase
    .from("approvals" as never)
    .delete()
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", pAppr.data);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

