import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const patchBody = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  campaign_id: z.string().uuid().nullable().optional(),
});

const deleteBody = z.object({
  organizationId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ funnelId: string }> },
) {
  const { funnelId } = await ctx.params;
  if (!z.string().uuid().safeParse(funnelId).success) {
    return NextResponse.json({ ok: false, message: "Invalid funnelId" }, { status: 400 });
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
  if (parsed.data.campaign_id !== undefined) patch.campaign_id = parsed.data.campaign_id;

  const { data, error } = await op.supabase
    .from("funnels" as never)
    .update(patch as never)
    .eq("id", funnelId)
    .eq("organization_id", parsed.data.organizationId)
    .select("id,name,status,campaign_id,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: "Funnel not found" }, { status: 404 });
  return NextResponse.json({ ok: true, funnel: data });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ funnelId: string }> },
) {
  const { funnelId } = await ctx.params;
  if (!z.string().uuid().safeParse(funnelId).success) {
    return NextResponse.json({ ok: false, message: "Invalid funnelId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const { error } = await op.supabase
    .from("funnels" as never)
    .delete()
    .eq("id", funnelId)
    .eq("organization_id", parsed.data.organizationId);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
