import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { updateAgent } from "@/services/openclaw/orchestrationService";

const patchSchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(["enabled", "disabled"]).optional(),
  approval_required: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await ctx.params;
  if (!z.string().uuid().safeParse(agentId).success) {
    return NextResponse.json({ ok: false, message: "Invalid agentId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const { organizationId, ...patch } = parsed.data;
  const agent = await updateAgent(orgCtx.supabase, organizationId, agentId, patch);
  return NextResponse.json({ ok: true, agent });
}
