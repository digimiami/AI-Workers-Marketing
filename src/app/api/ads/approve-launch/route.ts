import { NextResponse } from "next/server";

import { z } from "zod";

import { openclawDecisionErrorResponse, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decideApproval } from "@/services/openclaw/orchestrationService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  adCampaignId: z.string().uuid(),
});

const APPROVAL_ORDER = ["paid_ads_budget", "paid_ads_destination", "paid_ads_copy", "paid_ads_launch"] as const;

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const { organizationId, campaignId, adCampaignId } = parsed.data;

  const { data: rows, error } = await admin
    .from("approvals" as never)
    .select("id,approval_type,status,target_entity_id")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .in("approval_type", [...APPROVAL_ORDER]);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const list = ((rows ?? []) as Array<{ id: string; approval_type: string; target_entity_id?: string | null }>).filter(
    (r) => !r.target_entity_id || String(r.target_entity_id) === adCampaignId,
  );
  list.sort((a, b) => APPROVAL_ORDER.indexOf(a.approval_type as (typeof APPROVAL_ORDER)[number]) - APPROVAL_ORDER.indexOf(b.approval_type as (typeof APPROVAL_ORDER)[number]));

  const decided: string[] = [];

  try {
    for (const r of list) {
      await decideApproval(orgCtx.supabase, organizationId, r.id, orgCtx.user.id, "approved", undefined);
      decided.push(r.id);
    }
  } catch (e) {
    return openclawDecisionErrorResponse(e);
  }

  return NextResponse.json({ ok: true, decidedApprovalIds: decided });
}
