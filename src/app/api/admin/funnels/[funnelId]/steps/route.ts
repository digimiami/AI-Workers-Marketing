import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ funnelId: string }> },
) {
  const { funnelId } = await ctx.params;
  if (!z.string().uuid().safeParse(funnelId).success) {
    return NextResponse.json({ ok: false, message: "Invalid funnelId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsedOrg = z.string().uuid().safeParse(organizationId);
  if (!parsedOrg.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctxOrg = await withOrgMember(parsedOrg.data);
  if (ctxOrg.error) return ctxOrg.error;

  const { data, error } = await ctxOrg.supabase
    .from("funnel_steps" as never)
    .select("id,funnel_id,step_index,name,step_type,slug,is_public,created_at,updated_at")
    .eq("organization_id", parsedOrg.data)
    .eq("funnel_id", funnelId)
    .order("step_index", { ascending: true })
    .limit(400);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, steps: data ?? [] });
}

