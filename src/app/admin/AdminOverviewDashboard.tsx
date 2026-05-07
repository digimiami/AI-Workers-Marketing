"use client";

import * as React from "react";
import Link from "next/link";

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
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAutomationRealtime } from "@/hooks/useAutomationRealtime";
import { cn } from "@/lib/utils";

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
  architecture?: {
    singleBrain: { entities: string[] };
    dataSources: { connected: number; pending: number; disconnected: number };
    workers: { active: number };
    humanControl: { pendingApprovals: number };
  };
  realityCheck?: {
    toolFailures24h: number;
    providerErrors24h: number;
    missingDataSources: number;
  };
  last14d: {
    leads: number;
    runs: number;
    events: number;
    series: { day: string; leads: number; runs: number; events: number }[];
  };
};

type AutomationResponse = {
  ok: boolean;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    autoMode: {
      enabled: boolean;
      autoLaunchApproved: boolean;
      autoScaleApproved: boolean;
      lastOptimizedAt: string | null;
    };
  }>;
  summary: {
    autoModeEnabled: boolean;
    activeCampaigns: number;
    content: { scheduled: number; posted: number };
    jobs: { queued: number; running: number };
    metrics: Array<{ key: string; value_numeric: number | null; captured_at: string; campaign_id?: string | null }>;
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
  const [autoBusy, setAutoBusy] = React.useState(false);
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

  const automation = useQuery({
    queryKey: ["automation-status", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/automation/status?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as AutomationResponse;
    },
    refetchInterval: 30_000,
  });

  useAutomationRealtime(organizationId, () => {
    void automation.refetch();
    void overview.refetch();
  });

  const kpis = overview.data?.kpis;
  const rawSeries = overview.data?.last14d?.series;
  const series = Array.isArray(rawSeries) ? rawSeries : [];
  const arch = overview.data?.architecture;
  const reality = overview.data?.realityCheck;
  const auto = automation.data;
  const primaryCampaign = auto?.campaigns?.[0] ?? null;

  const entityPreview = React.useMemo(() => {
    const e = arch?.singleBrain?.entities;
    if (Array.isArray(e) && e.length) return e.slice(0, 5).join(" · ");
    return ["campaigns", "funnels", "leads", "content", "approvals"].join(" · ");
  }, [arch?.singleBrain?.entities]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Your Single Brain: live KPIs + worker activity, data inputs, approvals, and telemetry.
        </p>
      </div>

      {overview.isError ? (
        <p className="text-sm text-destructive">Failed to load overview.</p>
      ) : null}

      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Your system is running</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Traffic → Content → Landing → Signup → Campaign → Ads → Leads → Revenue → Optimization → Scale
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Auto Mode</span>
              <Switch
                checked={Boolean(primaryCampaign?.autoMode.enabled)}
                disabled={!primaryCampaign || autoBusy}
                onCheckedChange={(enabled) => {
                  if (!primaryCampaign) return;
                  setAutoBusy(true);
                  void fetch("/api/automation/status", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      organizationId,
                      campaignId: primaryCampaign.id,
                      enabled,
                      autoLaunchApproved: false,
                      autoScaleApproved: false,
                    }),
                  })
                    .then(() => automation.refetch())
                    .finally(() => setAutoBusy(false));
                }}
                size="sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-background/35 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Content</div>
            <div className="mt-1 text-sm font-medium">
              {automation.isLoading ? "Loading…" : `${auto?.summary.content.scheduled ?? 0} scheduled · ${auto?.summary.content.posted ?? 0} posted`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Viral shorts generated and scheduled in stub mode.</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/35 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ads</div>
            <div className="mt-1 text-sm font-medium">{auto?.summary.autoModeEnabled ? "Running / approval-gated" : "Ready to launch"}</div>
            <p className="mt-1 text-xs text-muted-foreground">Live spend requires plan + approval unless explicitly enabled.</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/35 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Optimization</div>
            <div className="mt-1 text-sm font-medium">
              {primaryCampaign?.autoMode.lastOptimizedAt ? "Active" : auto?.summary.autoModeEnabled ? "Queued" : "Standby"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Low CTR rewrites hooks; leaks trigger landing fixes.</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/35 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jobs</div>
            <div className="mt-1 text-sm font-medium">
              {automation.isLoading ? "Loading…" : `${auto?.summary.jobs.running ?? 0} running · ${auto?.summary.jobs.queued ?? 0} queued`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Campaigns keep running outside the UI session.</p>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-4">
            <Link
              href={primaryCampaign ? `/admin/workspace/review/${primaryCampaign.id}` : "/admin/onboarding/growth"}
              className={buttonVariants()}
            >
              {primaryCampaign ? "Launch campaign" : "Create campaign"}
            </Link>
            <Link href="/admin/approvals" className={buttonVariants({ variant: "outline" })}>
              Approve ads
            </Link>
            <Link href="/admin/leads" className={cn(buttonVariants({ variant: "outline" }))}>
              View leads
            </Link>
          </div>
        </CardContent>
      </Card>

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AiWorkers Single Brain architecture</CardTitle>
            <p className="text-xs text-muted-foreground">
              Data sources feed a central brain; specialized workers produce outputs; humans control risk.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Single Brain</p>
              <p className="mt-1 text-sm font-medium">Shared org memory</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {entityPreview}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data Sources</p>
              <p className="mt-1 text-sm font-medium">Inputs connected</p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Connected</span>
                  <span className="text-foreground">{overview.isLoading ? "…" : arch?.dataSources.connected ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending</span>
                  <span className="text-foreground">{overview.isLoading ? "…" : arch?.dataSources.pending ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Disconnected</span>
                  <span className="text-foreground">{overview.isLoading ? "…" : arch?.dataSources.disconnected ?? "—"}</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Human in control</p>
              <p className="mt-1 text-sm font-medium">Approvals + audit</p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Pending approvals</span>
                  <span className="text-foreground">
                    {overview.isLoading ? "…" : arch?.humanControl.pendingApprovals ?? kpis?.pendingApprovals ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Active workers</span>
                  <span className="text-foreground">{overview.isLoading ? "…" : arch?.workers.active ?? kpis?.activeAgents ?? "—"}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reality Check</CardTitle>
            <p className="text-xs text-muted-foreground">Conflicts, risk, missing inputs, provider errors.</p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
              <span className="text-muted-foreground">Tool failures (24h)</span>
              <span className="font-semibold">{overview.isLoading ? "…" : reality?.toolFailures24h ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
              <span className="text-muted-foreground">Provider errors (24h)</span>
              <span className="font-semibold">{overview.isLoading ? "…" : reality?.providerErrors24h ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
              <span className="text-muted-foreground">Non-connected sources</span>
              <span className="font-semibold">{overview.isLoading ? "…" : reality?.missingDataSources ?? "—"}</span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Reality Check is a guardrail summary (not a blocker). Use Approval Queue + Logs for details.
            </p>
          </CardContent>
        </Card>
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
            <div className="w-full min-w-0">
              <ResponsiveContainer width="100%" height={280} minWidth={0} debounce={50}>
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
