import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { getDataSources } from "@/services/dataSources/dataSources";

const qSchema = z.object({ organizationId: z.string().uuid() });

function toDayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number) {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    days.push(toDayKey(d));
  }
  return days;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = qSchema.safeParse({ organizationId: url.searchParams.get("organizationId") });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const orgId = parsed.data.organizationId;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 13);
  since.setUTCHours(0, 0, 0, 0);

  const [
    totalLeads,
    affiliateClicks,
    conversions,
    activeCampaigns,
    activeAgents,
    approvals,
    leadsSeries,
    runs,
    events,
    toolFailures24h,
    providerErrors24h,
  ] = await Promise.all([
    ctx.supabase.from("leads" as never).select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    ctx.supabase
      .from("affiliate_clicks" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    ctx.supabase.from("conversions" as never).select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    ctx.supabase
      .from("campaigns" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active"),
    ctx.supabase
      .from("agents" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "enabled"),
    ctx.supabase
      .from("approvals" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending"),
    ctx.supabase
      .from("leads" as never)
      .select("id,created_at", { count: "exact" })
      .eq("organization_id", orgId)
      .gte("created_at", since.toISOString()),
    ctx.supabase
      .from("agent_runs" as never)
      .select("id,created_at", { count: "exact" })
      .eq("organization_id", orgId)
      .gte("created_at", since.toISOString()),
    ctx.supabase
      .from("analytics_events" as never)
      .select("id,created_at", { count: "exact" })
      .eq("organization_id", orgId)
      .gte("created_at", since.toISOString()),
    ctx.supabase
      .from("openclaw_tool_calls" as never)
      .select("id,created_at", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("ok", false)
      .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString()),
    ctx.supabase
      .from("email_logs" as never)
      .select("id,created_at", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("error_message", "is", null)
      .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString()),
  ]);

  if (totalLeads.error) return NextResponse.json({ ok: false, message: totalLeads.error.message }, { status: 500 });
  if (affiliateClicks.error)
    return NextResponse.json({ ok: false, message: affiliateClicks.error.message }, { status: 500 });
  if (conversions.error) return NextResponse.json({ ok: false, message: conversions.error.message }, { status: 500 });
  if (activeCampaigns.error)
    return NextResponse.json({ ok: false, message: activeCampaigns.error.message }, { status: 500 });
  if (activeAgents.error) return NextResponse.json({ ok: false, message: activeAgents.error.message }, { status: 500 });
  if (approvals.error) return NextResponse.json({ ok: false, message: approvals.error.message }, { status: 500 });
  if (leadsSeries.error) return NextResponse.json({ ok: false, message: leadsSeries.error.message }, { status: 500 });
  if (runs.error) return NextResponse.json({ ok: false, message: runs.error.message }, { status: 500 });
  if (events.error) return NextResponse.json({ ok: false, message: events.error.message }, { status: 500 });
  if (toolFailures24h.error)
    return NextResponse.json({ ok: false, message: toolFailures24h.error.message }, { status: 500 });
  if (providerErrors24h.error)
    return NextResponse.json({ ok: false, message: providerErrors24h.error.message }, { status: 500 });

  const sources = await getDataSources(ctx.supabase as any, orgId).catch(() => []);
  const connectedSources = sources.filter((s) => s.status === "connected").length;
  const pendingSources = sources.filter((s) => s.status === "pending").length;
  const disconnectedSources = sources.filter((s) => s.status === "disconnected").length;

  const days = lastNDays(14);
  const leadByDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  const runByDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  const eventByDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));

  for (const r of (leadsSeries.data ?? []) as { created_at: string }[]) {
    const k = r.created_at?.slice(0, 10);
    if (k && k in leadByDay) leadByDay[k] += 1;
  }
  for (const r of (runs.data ?? []) as { created_at: string }[]) {
    const k = r.created_at?.slice(0, 10);
    if (k && k in runByDay) runByDay[k] += 1;
  }
  for (const r of (events.data ?? []) as { created_at: string }[]) {
    const k = r.created_at?.slice(0, 10);
    if (k && k in eventByDay) eventByDay[k] += 1;
  }

  const series = days.map((d) => ({ day: d.slice(5), leads: leadByDay[d], runs: runByDay[d], events: eventByDay[d] }));

  return NextResponse.json({
    ok: true,
    kpis: {
      totalLeads: totalLeads.count ?? 0,
      affiliateClicks: affiliateClicks.count ?? 0,
      conversions: conversions.count ?? 0,
      activeCampaigns: activeCampaigns.count ?? 0,
      activeAgents: activeAgents.count ?? 0,
      pendingApprovals: approvals.count ?? 0,
    },
    architecture: {
      singleBrain: {
        entities: [
          "organizations",
          "campaigns",
          "funnels",
          "leads",
          "content",
          "email sequences",
          "analytics events",
          "agent outputs",
          "approvals",
          "logs",
          "memory/context (metadata + settings)",
        ],
      },
      dataSources: {
        connected: connectedSources,
        pending: pendingSources,
        disconnected: disconnectedSources,
      },
      workers: {
        active: activeAgents.count ?? 0,
      },
      humanControl: {
        pendingApprovals: approvals.count ?? 0,
      },
    },
    realityCheck: {
      toolFailures24h: toolFailures24h.count ?? 0,
      providerErrors24h: providerErrors24h.count ?? 0,
      missingDataSources: Math.max(0, sources.filter((s) => s.status !== "connected").length),
    },
    last14d: {
      leads: leadsSeries.count ?? 0,
      runs: runs.count ?? 0,
      events: events.count ?? 0,
      series,
    },
  });
}

