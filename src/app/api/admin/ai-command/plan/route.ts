import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { buildAiMarketingPlan } from "@/services/ai-agent/agentOrchestrator";
import { aiModeSchema, aiProviderSchema, approvalModeSchema, runInputSchema } from "@/services/ai-agent/types";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  provider: aiProviderSchema,
  mode: aiModeSchema,
  url: z.string().url().nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  goal: z.string().min(1),
  niche: z.string().nullable().optional(),
  audience: z.string().nullable().optional(),
  trafficSource: z.string().nullable().optional(),
  campaignType: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  approvalMode: approvalModeSchema,
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  // Build plan without requiring a DB write.
  const plan = await buildAiMarketingPlan(
    runInputSchema.parse({
      organizationId: parsed.data.organizationId,
      userId: orgCtx.user.id,
      provider: parsed.data.provider,
      mode: parsed.data.mode,
      url: parsed.data.url ?? undefined,
      campaignId: parsed.data.campaignId ?? undefined,
      goal: parsed.data.goal,
      niche: parsed.data.niche ?? undefined,
      audience: parsed.data.audience ?? undefined,
      trafficSource: parsed.data.trafficSource ?? undefined,
      campaignType: parsed.data.campaignType ?? undefined,
      notes: parsed.data.notes ?? undefined,
      approvalMode: parsed.data.approvalMode,
    }),
  );

  return NextResponse.json({ ok: true, plan });
}

