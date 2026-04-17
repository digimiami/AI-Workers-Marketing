import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const patchBody = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(1).optional(),
  status: z.enum(["draft", "approved", "scheduled", "published", "archived"]).optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  funnel_id: z.string().uuid().nullable().optional(),
  script_markdown: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await ctx.params;
  if (!z.string().uuid().safeParse(assetId).success) {
    return NextResponse.json({ ok: false, message: "Invalid assetId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.campaign_id !== undefined) patch.campaign_id = parsed.data.campaign_id;
  if (parsed.data.funnel_id !== undefined) patch.funnel_id = parsed.data.funnel_id;
  if (parsed.data.script_markdown !== undefined) patch.script_markdown = parsed.data.script_markdown;

  const { data, error } = await op.supabase
    .from("content_assets" as never)
    .update(patch as never)
    .eq("id", assetId)
    .eq("organization_id", parsed.data.organizationId)
    .select("id,title,status,campaign_id,funnel_id,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: "Asset not found" }, { status: 404 });
  return NextResponse.json({ ok: true, asset: data });
}
