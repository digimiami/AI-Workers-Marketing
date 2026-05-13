import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { asMetadataRecord } from "@/lib/mergeJsonbRecords";
import { runGrowthOptimizationLoopCycle } from "@/services/growth/growthOptimizationLoop";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  autopilot: z.boolean().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const { data: camp } = await orgCtx.supabase
    .from("campaigns" as never)
    .select("metadata")
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", parsed.data.campaignId)
    .maybeSingle();
  const meta = asMetadataRecord((camp as { metadata?: unknown } | null)?.metadata);
  const ae = asMetadataRecord(meta.ads_engine);
  const autopilot =
    typeof parsed.data.autopilot === "boolean"
      ? parsed.data.autopilot
      : typeof ae.autopilot === "boolean"
        ? ae.autopilot
        : false;

  try {
    const out = await runGrowthOptimizationLoopCycle({
      organizationId: parsed.data.organizationId,
      campaignId: parsed.data.campaignId,
      autopilotEnabled: autopilot,
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "optimization loop failed" },
      { status: 500 },
    );
  }
}
