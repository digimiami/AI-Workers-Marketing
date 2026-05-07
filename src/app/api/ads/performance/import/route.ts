import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { emitStubPerformanceSnapshot } from "@/services/ads/adsLaunchService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  platform: z.enum(["google", "meta"]).default("google"),
  adCampaignId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const { organizationId, campaignId, platform } = parsed.data;

  let adCampaignId = parsed.data.adCampaignId ?? null;
  if (!adCampaignId) {
    const { data: ac } = await admin
      .from("ad_campaigns" as never)
      .select("id")
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .eq("platform", platform)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    adCampaignId = (ac as { id?: string } | null)?.id ? String((ac as { id: string }).id) : null;
  }

  if (!adCampaignId) {
    return NextResponse.json({ ok: false, message: "No ad_campaign found for import (prepare launch first)." }, { status: 400 });
  }

  const { data: ads } = await admin
    .from("ads" as never)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("ad_campaign_id", adCampaignId)
    .limit(200);

  await emitStubPerformanceSnapshot({
    organizationId,
    campaignId,
    platform,
    adRows: ((ads ?? []) as Array<{ id: string }>).map((r) => ({ id: String(r.id) })),
  });

  await admin.from("analytics_events" as never).insert({
    organization_id: organizationId,
    campaign_id: campaignId,
    event_name: "ad_performance.import",
    source: "api",
    properties: { platform, ad_campaign_id: adCampaignId, simulated: true },
    created_at: new Date().toISOString(),
  } as never);

  return NextResponse.json({ ok: true, imported: (ads ?? []).length, adCampaignId });
}
