import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { buildGrowthSystemStatus } from "@/services/growth/growthSystemStatus";

const querySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    organizationId: url.searchParams.get("organizationId"),
    campaignId: url.searchParams.get("campaignId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId and campaignId (uuid) required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const snapshot = await buildGrowthSystemStatus({
    supabase: ctx.supabase,
    organizationId: parsed.data.organizationId,
    campaignId: parsed.data.campaignId,
  });

  return NextResponse.json({ ok: true, ...snapshot });
}
