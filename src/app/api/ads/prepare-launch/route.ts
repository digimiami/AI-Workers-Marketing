import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { preparePaidAdsLaunch } from "@/services/ads/adsEngine";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  orgId: z.string().uuid().optional(),
  campaignId: z.string().uuid(),
  platform: z.enum(["google", "meta"]),
  dailyBudget: z.number().min(1).max(100000),
  objective: z.string().min(1).default("leads"),
  landingPageVariantId: z.string().uuid().optional(),
  approvalMode: z.enum(["required", "optional"]).default("required"),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const organizationId = parsed.data.orgId ?? parsed.data.organizationId;
  const orgCtx = await withOrgOperator(organizationId);
  if (orgCtx.error) return orgCtx.error;

  try {
    const prepared = await preparePaidAdsLaunch({
      orgId: organizationId,
      campaignId: parsed.data.campaignId,
      platform: parsed.data.platform,
      dailyBudget: parsed.data.dailyBudget,
      objective: parsed.data.objective,
      landingPageVariantId: parsed.data.landingPageVariantId ?? null,
      approvalMode: parsed.data.approvalMode,
    });
    return NextResponse.json({ ok: true, prepared });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "prepare failed" }, { status: 500 });
  }
}
