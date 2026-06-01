"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowUpRight, Bot, DollarSign, Megaphone, Target, TrendingUp, Users } from "lucide-react";

import { MissionControlChatbot } from "@/components/mission-control/MissionControlChatbot";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type OverviewPayload = {
  ok?: boolean;
  executive: {
    revenueCents: number;
    totalLeads: number;
    conversions: number;
    activeCampaigns: number;
    roas: number | null;
    pendingApprovals: number;
  };
  workers: {
    definitions: Array<{ key: string; name: string; description: string }>;
    activeAgents: number;
    runsLast14d: number;
    jobsQueued: number;
    jobsRunning: number;
  };
  recommendations: Array<{
    id?: string;
    title: string;
    body: string;
    action_href?: string | null;
    action_label?: string | null;
    category?: string;
  }>;
  notifications: { pendingApprovals: number; queuedJobs: number };
  activitySeries: Array<{ day: string; workerRuns: number }>;
};

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function MissionControlClient({ organizationId }: { organizationId: string }) {
  const overview = useQuery({
    queryKey: ["mission-control-overview", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/mission-control/overview?organizationId=${organizationId}`);
      const json = (await res.json()) as OverviewPayload & { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed to load overview");
      return json;
    },
    refetchInterval: 60_000,
  });

  const exec = overview.data?.executive;
  const recs = overview.data?.recommendations ?? [];

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-[1400px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">AI Workers</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-gradient-fx">
            Mission Control
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Chat with your AI assistant, monitor performance, and launch workers from one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/workspace" className={buttonVariants({ size: "sm", variant: "outline" })}>
            Live Workspace
          </Link>
          <Link href="/admin/growth-engine" className={buttonVariants({ size: "sm", variant: "outline" })}>
            Growth Engine
          </Link>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Revenue", value: formatUsd(exec?.revenueCents ?? 0), icon: DollarSign },
          { label: "Leads", value: String(exec?.totalLeads ?? "—"), icon: Users },
          { label: "Active campaigns", value: String(exec?.activeCampaigns ?? "—"), icon: Megaphone },
          { label: "ROAS", value: exec?.roas != null ? exec.roas.toFixed(2) : "—", icon: TrendingUp },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/60 glass-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{overview.isLoading ? "…" : kpi.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <motion.div
          className="lg:col-span-3 space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <MissionControlChatbot organizationId={organizationId} />

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" /> Worker fleet
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {(overview.data?.workers.definitions ?? []).map((w) => (
                <div key={w.key} className="rounded-lg border border-border/50 p-3 text-sm">
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{w.description}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div className="lg:col-span-2 space-y-4" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="border-border/60 glass-panel">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" /> Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending approvals</span>
                <span className="font-medium">{overview.data?.notifications.pendingApprovals ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Queued jobs</span>
                <span className="font-medium">{overview.data?.notifications.queuedJobs ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Worker runs (14d)</span>
                <span className="font-medium">{overview.data?.workers.runsLast14d ?? 0}</span>
              </div>
              {exec?.pendingApprovals ? (
                <Link href="/admin/approvals" className={cn(buttonVariants({ size: "sm" }), "w-full mt-2")}>
                  Review approvals
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recommendations yet.</p>
              ) : (
                recs.map((r, i) => (
                  <div key={r.id ?? i} className="rounded-lg border border-border/50 p-3 text-sm">
                    <div className="font-medium">{r.title}</div>
                    <p className="text-muted-foreground mt-1 text-xs">{r.body}</p>
                    {r.action_href ? (
                      <Link
                        href={r.action_href}
                        className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                      >
                        {r.action_label ?? "Open"}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
