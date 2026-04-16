import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { getHumanGateForRun, getRunDetail } from "@/services/openclaw/orchestrationService";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsedOrg = z.string().uuid().safeParse(organizationId);
  const parsedRun = z.string().uuid().safeParse(runId);
  if (!parsedOrg.success || !parsedRun.success) {
    return NextResponse.json({ ok: false, message: "organizationId and runId required" }, { status: 400 });
  }

  const orgCtx = await withOrgMember(parsedOrg.data);
  if (orgCtx.error) return orgCtx.error;

  const run = await getRunDetail(orgCtx.supabase, parsedOrg.data, parsedRun.data);
  const humanGate = await getHumanGateForRun(
    orgCtx.supabase,
    parsedOrg.data,
    parsedRun.data,
    run as Record<string, unknown>,
  );
  return NextResponse.json({ ok: true, run, humanGate });
}
