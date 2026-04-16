import { NextResponse } from "next/server";

import { z } from "zod";

import { openclawDecisionErrorResponse, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { rejectRun } from "@/services/openclaw/orchestrationService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().min(1),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;
  if (!z.string().uuid().safeParse(runId).success) {
    return NextResponse.json({ ok: false, message: "Invalid runId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  try {
    await rejectRun(
      orgCtx.supabase,
      parsed.data.organizationId,
      runId,
      orgCtx.user.id,
      parsed.data.reason,
    );
  } catch (e) {
    return openclawDecisionErrorResponse(e);
  }
  return NextResponse.json({ ok: true });
}
