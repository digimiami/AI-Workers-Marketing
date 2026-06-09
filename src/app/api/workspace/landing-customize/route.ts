import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { customizeLandingPageForCampaign } from "@/services/growth/customizeLandingPage";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  instruction: z.string().min(3).max(2000),
  variantKey: z.string().min(1).max(64).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const result = await customizeLandingPageForCampaign({
    admin,
    organizationId: parsed.data.organizationId,
    campaignId: parsed.data.campaignId,
    instruction: parsed.data.instruction,
    variantKey: parsed.data.variantKey,
    actorUserId: orgCtx.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    variantKey: result.variantKey,
    previewUrl: result.previewUrl,
    applied: result.applied,
    message: `Landing updated: ${result.applied.join(", ")}`,
  });
}
