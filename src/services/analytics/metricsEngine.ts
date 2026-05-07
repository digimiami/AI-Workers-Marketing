import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function div(n: number, d: number) {
  return d > 0 ? n / d : 0;
}

export async function computeCampaignMetrics(input: {
  organizationId: string;
  campaignId?: string | null;
  windowStart?: Date;
  windowEnd?: Date;
}) {
  const admin = createSupabaseAdminClient();
  const windowEnd = input.windowEnd ?? new Date();
  const windowStart = input.windowStart ?? new Date(windowEnd.getTime() - 30 * 24 * 3600_000);

  const campaignFilter = <T extends { eq: (col: string, v: string) => T }>(q: T) =>
    input.campaignId ? q.eq("campaign_id", input.campaignId) : q;

  const [adPerf, leads, conversions, events] = await Promise.all([
    campaignFilter(
      admin
        .from("ad_performance_events" as never)
        .select("impressions,clicks,spend,leads,conversions,captured_at")
        .eq("organization_id", input.organizationId)
        .gte("captured_at", windowStart.toISOString())
        .lte("captured_at", windowEnd.toISOString()),
    ),
    campaignFilter(
      admin
        .from("leads" as never)
        .select("id,created_at")
        .eq("organization_id", input.organizationId)
        .gte("created_at", windowStart.toISOString())
        .lte("created_at", windowEnd.toISOString()),
    ),
    campaignFilter(
      admin
        .from("conversions" as never)
        .select("id,value_cents,created_at")
        .eq("organization_id", input.organizationId)
        .gte("created_at", windowStart.toISOString())
        .lte("created_at", windowEnd.toISOString()),
    ),
    campaignFilter(
      admin
        .from("analytics_events" as never)
        .select("id,event_name,created_at")
        .eq("organization_id", input.organizationId)
        .gte("created_at", windowStart.toISOString())
        .lte("created_at", windowEnd.toISOString()),
    ),
  ]);

  if (adPerf.error) throw new Error(adPerf.error.message);
  if (leads.error) throw new Error(leads.error.message);
  if (conversions.error) throw new Error(conversions.error.message);
  if (events.error) throw new Error(events.error.message);

  const perfRows = (adPerf.data ?? []) as any[];
  const impressions = perfRows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = perfRows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const spend = perfRows.reduce((s, r) => s + Number(r.spend ?? 0), 0);
  const leadCount = (leads.data ?? []).length;
  const conversionCount = (conversions.data ?? []).length;
  const revenueCents = ((conversions.data ?? []) as any[]).reduce((s, r) => s + Number(r.value_cents ?? 0), 0);
  const revenue = revenueCents / 100;
  const profit = revenue - spend;

  const metric = {
    impressions,
    clicks,
    leads: leadCount,
    conversions: conversionCount,
    spend,
    revenue,
    profit,
    ctr: div(clicks, impressions),
    cpl: div(spend, leadCount),
    cpa: div(spend, conversionCount),
    conversionRate: div(leadCount, Math.max(clicks, 1)),
    roi: spend > 0 ? profit / spend : 0,
    events: (events.data ?? []).length,
  };

  const rows = Object.entries({
    ctr: metric.ctr,
    cpl: metric.cpl,
    cpa: metric.cpa,
    conversion_rate: metric.conversionRate,
    estimated_revenue: metric.revenue,
    profit: metric.profit,
    roi: metric.roi,
  }).map(([key, value]) => ({
    organization_id: input.organizationId,
    campaign_id: input.campaignId ?? null,
    scope: input.campaignId ? "campaign" : "organization",
    key,
    value_numeric: Number(value),
    value_json: metric,
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
    captured_at: new Date().toISOString(),
  }));

  const { error: mErr } = await admin.from("metrics" as never).insert(rows as never);
  if (mErr) throw new Error(mErr.message);

  return metric;
}

