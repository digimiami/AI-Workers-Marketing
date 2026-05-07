import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { launchPaidAdsAfterApprovals } from "@/services/ads/adsEngine";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  adCampaignId: z.string().uuid(),
  platform: z.enum(["google", "meta"]),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const { organizationId, campaignId, adCampaignId } = parsed.data;

  const { count: pendingPaidApprovals } = await admin
    .from("approvals" as never)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .in("approval_type", ["paid_ads_launch", "paid_ads_budget", "paid_ads_destination", "paid_ads_copy"]);

  if ((pendingPaidApprovals ?? 0) > 0) {
    return NextResponse.json(
      { ok: false, message: "Paid ads approvals are still pending. Approve launch items before simulating activate." },
      { status: 409 },
    );
  }

  const platform = parsed.data.platform;
  await launchPaidAdsAfterApprovals({ organizationId, campaignId, adCampaignId, platform });

  const { data: camp } = await admin.from("campaigns" as never).select("metadata").eq("id", campaignId).maybeSingle();
  const prev = asMetadataRecord((camp as { metadata?: unknown } | null)?.metadata);
  const next = mergeJsonbRecords(prev, {
    ads_engine: {
      last_simulate_launch_at: new Date().toISOString(),
      launch_status: "stub_simulated_active",
      last_ad_campaign_id: adCampaignId,
    },
  });
  await admin
    .from("campaigns" as never)
    .update({ metadata: next, updated_at: new Date().toISOString() } as never)
    .eq("organization_id", organizationId)
    .eq("id", campaignId);

  return NextResponse.json({ ok: true, platform: parsed.data.platform });
}
