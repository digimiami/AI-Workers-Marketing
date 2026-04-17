"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OverviewResponse = {
  ok: boolean;
  kpis: {
    totalLeads: number;
    affiliateClicks: number;
    conversions: number;
    activeCampaigns: number;
    activeAgents: number;
    pendingApprovals: number;
  };
  last14d: {
    leads: number;
    runs: number;
    events: number;
    series: { day: string; leads: number; runs: number; events: number }[];
  };
};

const kpiCards: { key: keyof OverviewResponse["kpis"]; title: string }[] = [
  { key: "totalLeads", title: "Total leads" },
  { key: "affiliateClicks", title: "Affiliate clicks" },
  { key: "conversions", title: "Conversions" },
  { key: "activeCampaigns", title: "Active campaigns" },
  { key: "activeAgents", title: "Active AI workers" },
  { key: "pendingApprovals", title: "Pending approvals" },
];

export function AdminOverviewDashboard({ organizationId }: { organizationId: string }) {
  const [chartReady, setChartReady] = React.useState(false);
  React.useEffect(() => {
    setChartReady(true);
  }, []);

  const overview = useQuery({
    queryKey: ["admin-overview", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/overview?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as OverviewResponse;
    },
  });

  const kpis = overview.data?.kpis;
  const series = overview.data?.last14d?.series ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Live KPIs and 14-day activity for leads, agent runs, and analytics events.
        </p>
      </div>

      {overview.isError ? (
        <p className="text-sm text-destructive">Failed to load overview.</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((k) => (
          <Card key={k.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">
                {overview.isLoading ? "…" : (kpis?.[k.key] ?? "—")}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Last 14 days</CardTitle>
          <p className="text-xs text-muted-foreground">
            New leads vs. agent runs vs. analytics events (UTC buckets).
          </p>
        </CardHeader>
        <CardContent>
          {overview.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading chart…</p>
          ) : chartReady ? (
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                <AreaChart data={series} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ovLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.72 0.14 195)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="oklch(0.72 0.14 195)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ovRuns" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.65 0.18 300)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="oklch(0.65 0.18 300)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ovEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.75 0.12 145)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="oklch(0.75 0.12 145)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="oklch(0.55 0.02 264)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="oklch(0.55 0.02 264)" width={36} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={(l) => `Day ${l}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="oklch(0.62 0.14 195)" fill="url(#ovLeads)" />
                  <Area type="monotone" dataKey="runs" name="Agent runs" stroke="oklch(0.58 0.16 300)" fill="url(#ovRuns)" />
                  <Area
                    type="monotone"
                    dataKey="events"
                    name="Analytics events"
                    stroke="oklch(0.62 0.12 145)"
                    fill="url(#ovEvents)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Preparing chart…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
