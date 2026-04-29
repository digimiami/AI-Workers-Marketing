import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { buildAiMarketingPlan } from "@/services/ai-agent/agentOrchestrator";
import { aiModeSchema, aiProviderSchema, approvalModeSchema, runInputSchema } from "@/services/ai-agent/types";
import { planWithInternalLlmDebug } from "@/services/ai-agent/internalLlmProvider";

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

  const input = runInputSchema.parse({
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
  });

  // Build plan without requiring a DB write. Return planner meta so we can confirm OpenAI is actually used.
  if (input.provider === "internal_llm" || input.provider === "hybrid") {
    const { plan, meta } = await planWithInternalLlmDebug({
      provider: input.provider,
      mode: input.mode,
      url: input.url,
      campaignId: input.campaignId,
      goal: input.goal,
      niche: input.niche,
      audience: input.audience,
      trafficSource: input.trafficSource,
      campaignType: input.campaignType,
      notes: input.notes,
      approvalMode: input.approvalMode,
    });
    return NextResponse.json({ ok: true, plan, planner: meta });
  }

  const plan = await buildAiMarketingPlan(input);

  return NextResponse.json({ ok: true, plan, planner: { used: false, provider: "fallback", reason: "Provider is openclaw; internal planner not used" } });
}

