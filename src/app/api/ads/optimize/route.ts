import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { asMetadataRecord } from "@/lib/mergeJsonbRecords";
import { runAdsOptimization } from "@/services/ads/adsOptimizer";
import { runGrowthOptimizationFromDb } from "@/services/growth/optimizationEngineService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  engine: z.enum(["growth", "ads", "both"]).default("both"),
  autopilot: z.boolean().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const { data: camp } = await admin
    .from("campaigns" as never)
    .select("metadata")
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", parsed.data.campaignId)
    .maybeSingle();
  const meta = asMetadataRecord((camp as { metadata?: unknown } | null)?.metadata);
  const ae = asMetadataRecord(meta.ads_engine);
  const autopilot = typeof parsed.data.autopilot === "boolean" ? parsed.data.autopilot : typeof ae.autopilot === "boolean" ? ae.autopilot : false;

  try {
    const out: Record<string, unknown> = {};
    if (parsed.data.engine === "growth" || parsed.data.engine === "both") {
      out.growth = await runGrowthOptimizationFromDb({
        organizationId: parsed.data.organizationId,
        campaignId: parsed.data.campaignId,
        autopilotEnabled: autopilot,
      });
    }
    if (parsed.data.engine === "ads" || parsed.data.engine === "both") {
      out.ads = await runAdsOptimization({
        organizationId: parsed.data.organizationId,
        campaignId: parsed.data.campaignId,
        platform: typeof ae.platform === "string" ? ae.platform : null,
        autopilotEnabled: autopilot,
      });
    }
    return NextResponse.json({ ok: true, optimization: out });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "optimize failed" }, { status: 500 });
  }
}
