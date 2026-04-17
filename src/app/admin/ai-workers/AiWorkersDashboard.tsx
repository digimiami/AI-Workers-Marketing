"use client";

import * as React from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type AgentRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: "enabled" | "disabled";
  approval_required: boolean;
  last_run_at: string | null;
};

export function AiWorkersDashboard({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [runAgentId, setRunAgentId] = React.useState<string | null>(null);
  const [runAgentName, setRunAgentName] = React.useState("");
  const [runInput, setRunInput] = React.useState("{}");

  const agentsQuery = useQuery({
    queryKey: ["openclaw-agents", organizationId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/openclaw/agents?organizationId=${organizationId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as {
        ok: boolean;
        agents: AgentRow[];
        backend: {
          active: string;
          httpConfigured: boolean;
          health?: { ok: boolean; message?: string } | null;
        };
      };
    },
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/campaigns?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; campaigns: { id: string; name: string }[] };
      return j.campaigns ?? [];
    },
  });

  const schedulesQuery = useQuery({
    queryKey: ["openclaw-schedules", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/openclaw/schedules?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; schedules: unknown[] };
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/openclaw/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      toast.success("Agents synced from registry");
      await qc.invalidateQueries({ queryKey: ["openclaw-agents", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  });

  const patchAgent = useMutation({
    mutationFn: async (vars: {
      agentId: string;
      status?: "enabled" | "disabled";
      approval_required?: boolean;
    }) => {
      const res = await fetch(`/api/admin/openclaw/agents/${vars.agentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          status: vars.status,
          approval_required: vars.approval_required,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["openclaw-agents", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const runMutation = useMutation({
    mutationFn: async (agentId: string) => {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(runInput || "{}") as Record<string, unknown>;
      } catch {
        throw new Error("Input must be valid JSON");
      }
      const res = await fetch(`/api/admin/openclaw/agents/${agentId}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, input }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      toast.success("Run completed");
      setRunAgentId(null);
      setRunAgentName("");
      setRunInput("{}");
      await qc.invalidateQueries({ queryKey: ["openclaw-agents", organizationId] });
      await qc.invalidateQueries({ queryKey: ["openclaw-runs", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Run failed"),
  });

  const [scheduleForm, setScheduleForm] = React.useState({
    name: "Nightly analyst",
    cron_expression: "0 2 * * *",
    agent_id: "",
  });

  const createSchedule = useMutation({
    mutationFn: async () => {
      if (!scheduleForm.agent_id) throw new Error("Pick an agent");
      const res = await fetch("/api/admin/openclaw/schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          agent_id: scheduleForm.agent_id,
          name: scheduleForm.name,
          cron_expression: scheduleForm.cron_expression,
          timezone: "UTC",
          payload: {},
          enabled: true,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      toast.success("Schedule created");
      await qc.invalidateQueries({ queryKey: ["openclaw-schedules", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [assignCampaignId, setAssignCampaignId] = React.useState("");
  const [assignAgentId, setAssignAgentId] = React.useState("");

  const assignCampaignAgent = useMutation({
    mutationFn: async () => {
      if (!assignCampaignId || !assignAgentId) throw new Error("Select campaign and agent");
      const res = await fetch("/api/admin/openclaw/campaign-agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          campaign_id: assignCampaignId,
          agent_id: assignAgentId,
          priority: 0,
          config: {},
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => toast.success("Agent assigned to campaign"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Assign failed"),
  });

  const agents = agentsQuery.data?.agents ?? [];
  const backend = agentsQuery.data?.backend;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Workers (OpenClaw)</h1>
          <p className="text-sm text-muted-foreground">
            Registry-backed agents, manual runs, schedules, campaign assignment, and approvals.
          </p>
          {backend ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Provider: <span className="text-foreground">{backend.active}</span>
              {backend.httpConfigured ? " (HTTP endpoint configured)" : " (stub until OPENCLAW_BASE_URL is set)"}
              {backend.health ? (
                <>
                  {" · "}
                  <span className={backend.health.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                    {backend.health.ok
                      ? "OpenClaw /health OK"
                      : `Health: ${backend.health.message ?? "unreachable"}`}
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? "Syncing…" : "Sync from registry"}
          </Button>
          <Link
            href="/admin/ai-workers/runs"
            className={buttonVariants({ variant: "secondary" })}
          >
            Run history
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Workers</CardTitle>
        </CardHeader>
        <CardContent>
          {agentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : agentsQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load agents.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.key}</div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={a.status === "enabled"}
                        onCheckedChange={(checked) =>
                          patchAgent.mutate({
                            agentId: a.id,
                            status: checked ? "enabled" : "disabled",
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={a.approval_required}
                        onCheckedChange={(checked) =>
                          patchAgent.mutate({
                            agentId: a.id,
                            approval_required: checked,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link
                        href={`/admin/ai-workers/prompts/${a.id}`}
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                      >
                        Prompts
                      </Link>
                      <Button
                        size="sm"
                        onClick={() => {
                          setRunAgentId(a.id);
                          setRunAgentName(a.name);
                          setRunInput("{}");
                        }}
                      >
                        Run
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scheduled tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select
                value={scheduleForm.agent_id}
                onValueChange={(v) =>
                  setScheduleForm((s) => ({
                    ...s,
                    agent_id: typeof v === "string" ? v : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sname">Name</Label>
              <Input
                id="sname"
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cron">Cron expression</Label>
              <Input
                id="cron"
                value={scheduleForm.cron_expression}
                onChange={(e) =>
                  setScheduleForm((s) => ({ ...s, cron_expression: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Runner uses next_run_at; refine with a cron parser for production.
              </p>
            </div>
            <Button
              className="w-full"
              variant="secondary"
              disabled={createSchedule.isPending}
              onClick={() => createSchedule.mutate()}
            >
              Add schedule
            </Button>
            <div className="text-sm text-muted-foreground">
              {Array.isArray(schedulesQuery.data?.schedules)
                ? schedulesQuery.data.schedules.length
                : 0}{" "}
              schedule(s)
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Production: Vercel Cron calls{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">GET /api/cron/agent-schedules</code> every
              10 minutes with <code className="rounded bg-muted px-1 py-0.5 text-[10px]">Authorization: Bearer CRON_SECRET</code>
              . Requires <code className="rounded bg-muted px-1 py-0.5 text-[10px]">CRON_SECRET</code> and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">SUPABASE_SERVICE_ROLE_KEY</code> on the server.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign</Label>
              <Select
                value={assignCampaignId}
                onValueChange={(v) => setAssignCampaignId(typeof v === "string" ? v : "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  {(campaignsQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select
                value={assignAgentId}
                onValueChange={(v) => setAssignAgentId(typeof v === "string" ? v : "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={assignCampaignAgent.isPending}
              onClick={() => assignCampaignAgent.mutate()}
            >
              Assign agent to campaign
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!runAgentId}
        onOpenChange={(o) => {
          if (!o) {
            setRunAgentId(null);
            setRunAgentName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run {runAgentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="json">Input (JSON)</Label>
            <Textarea
              id="json"
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
            <Button
              className="w-full"
              disabled={runMutation.isPending || !runAgentId}
              onClick={() => runAgentId && runMutation.mutate(runAgentId)}
            >
              {runMutation.isPending ? "Running…" : "Execute"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
