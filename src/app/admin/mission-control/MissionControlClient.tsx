"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bot,
  DollarSign,
  Loader2,
  Megaphone,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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

const EXAMPLE_COMMANDS = [
  "Create a marketing campaign for my roofing business",
  "Build a landing page for lead capture",
  "Launch a Facebook campaign with $500 budget",
  "Generate a 7-day email nurture sequence",
  "Analyze my campaign performance and suggest optimizations",
];

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function MissionControlClient({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = React.useState("");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

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

  const command = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/mission-control/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          sessionId: sessionId ?? undefined,
          message: text,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Command failed");
      return json as { sessionId: string; reply: string; routed: { intent: string; primaryWorker: string } };
    },
    onSuccess: (data, text) => {
      setSessionId(data.sessionId);
      setThread((t) => [
        ...t,
        { role: "user", content: text },
        { role: "assistant", content: data.reply },
      ]);
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["mission-control-overview", organizationId] });
      toast.success(`Routed to ${data.routed.primaryWorker.replace(/_/g, " ")}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Command failed"),
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
            Your business operating system — executive metrics, worker orchestration, and natural-language commands.
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
          <Card className="border-border/60 glass-panel overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-accent/20">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>AI Command Center</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Describe what you want. Workers are assigned automatically.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[360px] overflow-y-auto p-4 space-y-3">
                {thread.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                    Try a command below or type your own business goal.
                  </div>
                ) : (
                  thread.map((m, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm max-w-[92%] whitespace-pre-wrap",
                        m.role === "user"
                          ? "ml-auto bg-primary/15 text-foreground"
                          : "mr-auto bg-muted/50 text-foreground",
                      )}
                    >
                      {m.content}
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-border/50 p-4 space-y-3 bg-background/50">
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_COMMANDS.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      className="text-xs rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                      onClick={() => setMessage(ex)}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g. Generate 100 leads for my roofing business"
                    rows={2}
                    className="resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (message.trim() && !command.isPending) command.mutate(message.trim());
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="shrink-0 h-auto aspect-square"
                    disabled={!message.trim() || command.isPending}
                    onClick={() => command.mutate(message.trim())}
                  >
                    {command.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

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
