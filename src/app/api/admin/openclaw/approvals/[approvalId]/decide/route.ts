import { NextResponse } from "next/server";

import { z } from "zod";

import { openclawDecisionErrorResponse, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { decideApproval } from "@/services/openclaw/orchestrationService";

const bodySchema = z
  .object({
    organizationId: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().optional(),
  })
  .refine(
    (d) => d.decision !== "rejected" || (d.reason != null && d.reason.trim().length >= 1),
    { message: "reason is required when rejecting", path: ["reason"] },
  );

export async function POST(
  request: Request,
  ctx: { params: Promise<{ approvalId: string }> },
) {
  const { approvalId } = await ctx.params;
  if (!z.string().uuid().safeParse(approvalId).success) {
    return NextResponse.json({ ok: false, message: "Invalid approvalId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  try {
    await decideApproval(
      orgCtx.supabase,
      parsed.data.organizationId,
      approvalId,
      orgCtx.user.id,
      parsed.data.decision,
      parsed.data.reason,
    );
  } catch (e) {
    if (e instanceof Error && e.message === "Approval not found") {
      return NextResponse.json({ ok: false, message: e.message }, { status: 404 });
    }
    return openclawDecisionErrorResponse(e);
  }
  return NextResponse.json({ ok: true });
}
