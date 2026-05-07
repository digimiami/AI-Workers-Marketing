import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { runAiGrowthEngine } from "@/services/growth/growthEngine";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  orgId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  url: z.string().url(),
  goal: z.string().min(2),
  audience: z.string().min(2),
  trafficSource: z.string().min(2),
  budget: z.number().min(1).max(100000).default(25),
  provider: z.enum(["openclaw", "internal_llm", "hybrid"]).default("hybrid"),
  adsProviderMode: z.enum(["stub", "live"]).default("stub"),
  approvalMode: z.enum(["required", "auto_draft"]).default("required"),
  mode: z.enum(["affiliate", "client"]).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body", issues: parsed.error.flatten() }, { status: 400 });

  const organizationId = parsed.data.orgId ?? parsed.data.organizationId;
  const orgCtx = await withOrgOperator(organizationId);
  if (orgCtx.error) return orgCtx.error;

  try {
    const out = await runAiGrowthEngine({
      supabase: orgCtx.supabase,
      actorUserId: orgCtx.user.id,
      input: {
        orgId: organizationId,
        userId: parsed.data.userId ?? orgCtx.user.id,
        url: parsed.data.url,
        goal: parsed.data.goal,
        audience: parsed.data.audience,
        trafficSource: parsed.data.trafficSource,
        budget: parsed.data.budget,
        provider: parsed.data.provider,
        adsProviderMode: parsed.data.adsProviderMode,
        approvalMode: parsed.data.approvalMode,
        mode: parsed.data.mode,
      },
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Growth engine failed";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
