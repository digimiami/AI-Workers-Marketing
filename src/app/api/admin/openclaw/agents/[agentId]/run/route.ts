import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import {
  createPendingRun,
  executePendingRun,
} from "@/services/openclaw/orchestrationService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  input: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await ctx.params;
  if (!z.string().uuid().safeParse(agentId).success) {
    return NextResponse.json({ ok: false, message: "Invalid agentId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const run = await createPendingRun(orgCtx.supabase, {
    organizationId: parsed.data.organizationId,
    agentId,
    campaignId: parsed.data.campaignId ?? null,
    input: parsed.data.input ?? {},
    templateId: parsed.data.templateId ?? null,
    actorUserId: orgCtx.user.id,
  });

  const runId = (run as { id: string }).id;
  const exec = await executePendingRun(orgCtx.supabase, {
    organizationId: parsed.data.organizationId,
    runId,
    actorUserId: orgCtx.user.id,
  });

  const { data: finalRun } = await orgCtx.supabase
    .from("agent_runs" as never)
    .select("*")
    .eq("id", runId)
    .single();

  return NextResponse.json({ ok: exec.ok, run: finalRun });
}
