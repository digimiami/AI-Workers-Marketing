import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { removeCampaignAgent } from "@/services/openclaw/orchestrationService";

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ linkId: string }> },
) {
  const { linkId } = await ctx.params;
  if (!z.string().uuid().safeParse(linkId).success) {
    return NextResponse.json({ ok: false, message: "Invalid linkId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsedOrg = z.string().uuid().safeParse(organizationId);
  if (!parsedOrg.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsedOrg.data);
  if (orgCtx.error) return orgCtx.error;

  await removeCampaignAgent(orgCtx.supabase, parsedOrg.data, linkId);
  return NextResponse.json({ ok: true });
}
