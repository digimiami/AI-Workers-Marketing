import type { SupabaseClient } from "@supabase/supabase-js";

import { listMissionWorkers } from "@/domain/mission-control/workerRegistry";
import { getDataSources } from "@/services/dataSources/dataSources";

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

export async function getMissionControlOverview(db: SupabaseClient, organizationId: string) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 13);
  since.setUTCHours(0, 0, 0, 0);

  const [
    leads,
    conversions,
    activeCampaigns,
    activeAgents,
    pendingApprovals,
    runs14d,
    jobsQueued,
    jobsRunning,
    metricsRows,
    recommendations,
    recentRuns,
    dataSources,
  ] = await Promise.all([
    db.from("leads" as never).select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    db.from("conversions" as never).select("id,value_cents", { count: "exact" }).eq("organization_id", organizationId),
    db
      .from("campaigns" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active"),
    db
      .from("agents" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "enabled"),
    db
      .from("approvals" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending"),
    db
      .from("agent_runs" as never)
      .select("id,status,created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", since.toISOString()),
    db
      .from("jobs" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "queued"),
    db
      .from("jobs" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "running"),
    db
      .from("metrics" as never)
      .select("key,value_numeric,captured_at,campaign_id")
      .eq("organization_id", organizationId)
      .order("captured_at", { ascending: false })
      .limit(24),
    db
      .from("mission_control_recommendations" as never)
      .select("id,title,body,category,priority,action_href,action_label,created_at")
      .eq("organization_id", organizationId)
      .is("dismissed_at", null)
      .order("priority", { ascending: false })
      .limit(8),
    db
      .from("agent_runs" as never)
      .select("id,status,created_at,agent_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(12),
    getDataSources(db, organizationId).catch(() => []),
  ]);

  const dsItems = Array.isArray(dataSources) ? dataSources : [];
  const dataSourcesSummary = {
    connected: dsItems.filter((d) => d.status === "connected").length,
    pending: dsItems.filter((d) => d.status === "pending").length,
    disconnected: dsItems.filter((d) => d.status === "disconnected" || d.status === "stubbed").length,
    items: dsItems,
  };

  const conversionRows = (conversions.data ?? []) as Array<{ value_cents?: number | null }>;
  const revenueCents = conversionRows.reduce((sum, row) => sum + (row.value_cents ?? 0), 0);

  const days = lastNDays(14);
  const runsByDay = new Map<string, number>();
  for (const d of days) runsByDay.set(d, 0);
  for (const run of (runs14d.data ?? []) as Array<{ created_at: string }>) {
    const key = toDayKey(new Date(run.created_at));
    runsByDay.set(key, (runsByDay.get(key) ?? 0) + 1);
  }

  const roasMetric = ((metricsRows.data ?? []) as Array<{ key: string; value_numeric: number | null }>).find(
    (m) => m.key === "roas" || m.key === "roi",
  );

  const workers = listMissionWorkers().map((w) => ({
    key: w.key,
    name: w.name,
    description: w.description,
    capabilities: w.capabilities,
  }));

  const fallbackRecommendations =
    (recommendations.data ?? []).length > 0
      ? recommendations.data
      : buildHeuristicRecommendations({
          pendingApprovals: pendingApprovals.count ?? 0,
          jobsQueued: jobsQueued.count ?? 0,
          dataSourcesDisconnected: dataSourcesSummary.disconnected,
          activeCampaigns: activeCampaigns.count ?? 0,
        });

  return {
    executive: {
      revenueCents,
      totalLeads: leads.count ?? 0,
      conversions: conversions.count ?? 0,
      activeCampaigns: activeCampaigns.count ?? 0,
      roas: roasMetric?.value_numeric ?? null,
      pendingApprovals: pendingApprovals.count ?? 0,
    },
    campaigns: {
      active: activeCampaigns.count ?? 0,
      metrics: (metricsRows.data ?? []).slice(0, 8),
    },
    funnel: {
      note: "Funnel performance rolls up from analytics_events and landing variant keys.",
    },
    workers: {
      definitions: workers,
      activeAgents: activeAgents.count ?? 0,
      runsLast14d: runs14d.data?.length ?? 0,
      jobsQueued: jobsQueued.count ?? 0,
      jobsRunning: jobsRunning.count ?? 0,
      recentRuns: recentRuns.data ?? [],
    },
    integrations: dataSourcesSummary,
    notifications: {
      pendingApprovals: pendingApprovals.count ?? 0,
      queuedJobs: jobsQueued.count ?? 0,
    },
    recommendations: fallbackRecommendations,
    activitySeries: days.map((day) => ({ day, workerRuns: runsByDay.get(day) ?? 0 })),
  };
}

function buildHeuristicRecommendations(input: {
  pendingApprovals: number;
  jobsQueued: number;
  dataSourcesDisconnected: number;
  activeCampaigns: number;
}) {
  const items: Array<{
    id: string;
    title: string;
    body: string;
    category: string;
    priority: number;
    action_href: string | null;
    action_label: string | null;
  }> = [];

  if (input.pendingApprovals > 0) {
    items.push({
      id: "rec-approvals",
      title: "Approvals waiting",
      body: `${input.pendingApprovals} high-risk actions need your decision before publish or spend.`,
      category: "workers",
      priority: 90,
      action_href: "/admin/approvals",
      action_label: "Review queue",
    });
  }
  if (input.dataSourcesDisconnected > 0) {
    items.push({
      id: "rec-integrations",
      title: "Connect ad & analytics sources",
      body: "Mission Control works best with Meta, Google, and analytics connected for live optimization.",
      category: "integrations",
      priority: 80,
      action_href: "/admin/settings",
      action_label: "Open settings",
    });
  }
  if (input.activeCampaigns === 0) {
    items.push({
      id: "rec-first-campaign",
      title: "Launch your first campaign",
      body: 'Try: "Create a marketing campaign for my business" in the Command Center.',
      category: "campaigns",
      priority: 70,
      action_href: "/admin/mission-control",
      action_label: "Open Command Center",
    });
  }
  if (input.jobsQueued > 0) {
    items.push({
      id: "rec-jobs",
      title: "Background jobs queued",
      body: `${input.jobsQueued} automation jobs are waiting to run.`,
      category: "workers",
      priority: 60,
      action_href: "/admin/growth-engine",
      action_label: "Growth Engine",
    });
  }

  return items;
}
