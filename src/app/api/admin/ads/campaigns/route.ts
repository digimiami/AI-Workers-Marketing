import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsed = z.string().uuid().safeParse(organizationId);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });

  const ctx = await withOrgOperator(parsed.data);
  if (ctx.error) return ctx.error;

  const admin = createSupabaseAdminClient();
  const { data: campaigns, error } = await admin
    .from("ad_campaigns" as never)
    .select("id,campaign_id,platform,name,objective,status,daily_budget,destination_url,created_at,updated_at")
    .eq("organization_id", parsed.data)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const rows = (campaigns ?? []) as any[];
  const adCampaignIds = rows.map((r) => String(r.id));

  const perfByAdCampaign = new Map<string, { impressions: number; clicks: number; spend: number; leads: number }>();

  if (adCampaignIds.length) {
    const { data: ads } = await admin
      .from("ads" as never)
      .select("id,ad_campaign_id")
      .eq("organization_id", parsed.data)
      .in("ad_campaign_id", adCampaignIds)
      .limit(5000);
    const adIds = ((ads ?? []) as any[]).map((a) => String(a.id)).filter(Boolean);
    const adIdToCampaign = new Map<string, string>();
    for (const a of (ads ?? []) as any[]) adIdToCampaign.set(String(a.id), String(a.ad_campaign_id));

    if (adIds.length) {
      const { data: perf } = await admin
        .from("ad_performance_events" as never)
        .select("ad_id,impressions,clicks,spend,leads,captured_at")
        .eq("organization_id", parsed.data)
        .in("ad_id", adIds)
        .order("captured_at", { ascending: false })
        .limit(8000);

      for (const p of (perf ?? []) as any[]) {
        const adId = String(p.ad_id ?? "");
        const acId = adIdToCampaign.get(adId);
        if (!acId) continue;
        const cur = perfByAdCampaign.get(acId) ?? { impressions: 0, clicks: 0, spend: 0, leads: 0 };
        cur.impressions += Number(p.impressions ?? 0);
        cur.clicks += Number(p.clicks ?? 0);
        cur.spend += Number(p.spend ?? 0);
        cur.leads += Number(p.leads ?? 0);
        perfByAdCampaign.set(acId, cur);
      }
    }
  }

  const enriched = rows.map((r) => {
    const m = perfByAdCampaign.get(String(r.id)) ?? { impressions: 0, clicks: 0, spend: 0, leads: 0 };
    const ctr = m.impressions ? m.clicks / m.impressions : 0;
    const cpl = m.leads ? m.spend / m.leads : null;
    return {
      ...r,
      metrics: { ...m, ctr, cpl },
    };
  });

  return NextResponse.json({ ok: true, campaigns: enriched });
}
