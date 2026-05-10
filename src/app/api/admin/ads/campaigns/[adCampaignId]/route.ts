import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const patchBody = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  objective: z.string().nullable().optional(),
  daily_budget: z.number().nonnegative().nullable().optional(),
  destination_url: z.string().max(2048).nullable().optional(),
});

const deleteBody = z.object({
  organizationId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ adCampaignId: string }> },
) {
  const { adCampaignId } = await ctx.params;
  if (!z.string().uuid().safeParse(adCampaignId).success) {
    return NextResponse.json({ ok: false, message: "Invalid adCampaignId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.objective !== undefined) patch.objective = parsed.data.objective;
  if (parsed.data.daily_budget !== undefined) patch.daily_budget = parsed.data.daily_budget;
  if (parsed.data.destination_url !== undefined) patch.destination_url = parsed.data.destination_url;

  const { data, error } = await op.supabase
    .from("ad_campaigns" as never)
    .update(patch as never)
    .eq("id", adCampaignId)
    .eq("organization_id", parsed.data.organizationId)
    .select("id,name,status,objective,daily_budget,destination_url,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: "Ad campaign not found" }, { status: 404 });
  return NextResponse.json({ ok: true, campaign: data });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ adCampaignId: string }> },
) {
  const { adCampaignId } = await ctx.params;
  if (!z.string().uuid().safeParse(adCampaignId).success) {
    return NextResponse.json({ ok: false, message: "Invalid adCampaignId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const { error } = await op.supabase
    .from("ad_campaigns" as never)
    .delete()
    .eq("id", adCampaignId)
    .eq("organization_id", parsed.data.organizationId);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
