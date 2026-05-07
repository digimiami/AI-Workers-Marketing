import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { regenerateLandingVariantsForCampaign } from "@/services/growth/regenerateLandingVariants";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  url: z.string().url(),
  goal: z.string().min(2),
  audience: z.string().min(2),
  trafficSource: z.string().min(2),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const result = await regenerateLandingVariantsForCampaign({
    admin,
    input: parsed.data,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        needsGenerationFix: true,
        reason: result.reason,
        message: result.message,
        rejections: result.rejections,
        detail: "detail" in result ? result.detail : undefined,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    variantsWritten: result.variantsWritten,
    keys: result.keys,
    finalUrl: result.finalUrl,
    landingVariants: result.raw,
  });
}
