import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decideApproval } from "@/services/openclaw/orchestrationService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  section: z.enum(["funnel", "content", "email", "cta"]),
  action: z.enum(["approve", "reject", "deploy"]),
  reason: z.string().optional(),
});

function targetTypesForSection(section: z.infer<typeof bodySchema>["section"]) {
  if (section === "funnel") return ["funnel_step"] as const;
  if (section === "content") return ["content_asset"] as const;
  if (section === "email") return ["email_sequence", "email_template"] as const;
  return ["affiliate_link"] as const;
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  if (parsed.data.action === "reject" && (!parsed.data.reason || parsed.data.reason.trim().length < 1)) {
    return NextResponse.json({ ok: false, message: "reason required for reject" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const types = targetTypesForSection(parsed.data.section);

  if (parsed.data.action === "approve" || parsed.data.action === "reject") {
    const decision = parsed.data.action === "approve" ? ("approved" as const) : ("rejected" as const);
    const { data: approvals, error } = await admin
      .from("approvals" as never)
      .select("id,target_entity_type,target_entity_id,status,approval_type")
      .eq("organization_id", parsed.data.organizationId)
      .eq("campaign_id", parsed.data.campaignId)
      .eq("status", "pending")
      .in("target_entity_type", Array.from(types) as any)
      .limit(500);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    for (const a of approvals ?? []) {
      await decideApproval(
        admin as any,
        parsed.data.organizationId,
        String((a as any).id),
        orgCtx.user.id,
        decision,
        parsed.data.reason,
      );
    }

    return NextResponse.json({ ok: true, decided: (approvals ?? []).length });
  }

  // deploy: mark ready_to_deploy -> deployed and trigger local queues/activation
  if (parsed.data.section === "funnel") {
    // Activate funnel + deploy steps
    const { data: camp } = await admin
      .from("campaigns" as never)
      .select("funnel_id")
      .eq("organization_id", parsed.data.organizationId)
      .eq("id", parsed.data.campaignId)
      .maybeSingle();
    const funnelId = (camp as any)?.funnel_id ? String((camp as any).funnel_id) : null;
    if (funnelId) {
      await admin
        .from("funnels" as never)
        .update({ status: "active", updated_at: new Date().toISOString() } as never)
        .eq("organization_id", parsed.data.organizationId)
        .eq("id", funnelId);
      await admin
        .from("funnel_steps" as never)
        .update({ review_status: "deployed", updated_at: new Date().toISOString() } as never)
        .eq("organization_id", parsed.data.organizationId)
        .eq("funnel_id", funnelId)
        .eq("review_status", "ready_to_deploy");
    }
  }

  if (parsed.data.section === "content") {
    await admin
      .from("content_assets" as never)
      .update({ review_status: "deployed", updated_at: new Date().toISOString() } as never)
      .eq("organization_id", parsed.data.organizationId)
      .eq("campaign_id", parsed.data.campaignId)
      .eq("review_status", "ready_to_deploy");
  }

  if (parsed.data.section === "email") {
    await admin
      .from("email_sequences" as never)
      .update({ review_status: "deployed", is_active: true, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", parsed.data.organizationId)
      .eq("campaign_id", parsed.data.campaignId)
      .eq("review_status", "ready_to_deploy");
  }

  if (parsed.data.section === "cta") {
    await admin
      .from("affiliate_links" as never)
      .update({ review_status: "deployed", is_active: true, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", parsed.data.organizationId)
      .eq("campaign_id", parsed.data.campaignId)
      .eq("review_status", "ready_to_deploy");
  }

  return NextResponse.json({ ok: true });
}

