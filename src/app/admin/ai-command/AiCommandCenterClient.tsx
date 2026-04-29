"use client";

import * as React from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const providerSchema = z.enum(["openclaw", "internal_llm", "hybrid"]);
const modeSchema = z.enum([
  "create_campaign",
  "improve_campaign",
  "generate_content",
  "build_funnel",
  "build_email_sequence",
  "analyze_performance",
  "create_ads",
  "setup_lead_capture",
]);
type Provider = z.infer<typeof providerSchema>;
type Mode = z.infer<typeof modeSchema>;

type Plan = {
  objective: string;
  steps: Array<{
    name: string;
    tools_needed: string[];
    records_to_create: string[];
    approval_required: boolean;
    risk_level: "low" | "medium" | "high";
  }>;
  expected_outputs: string[];
};

type RunResult = {
  ok: boolean;
  runId: string;
  plan: Plan;
  createdRecords: Record<string, unknown>;
  updatedRecords: Record<string, unknown>;
  approvalItems: Array<{ id: string; status: string; approval_type: string }>;
  warnings: string[];
  errors: string[];
};

function asRows<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function AiCommandCenterClient({ organizationId }: { organizationId: string }) {
  const [provider, setProvider] = React.useState<Provider>("hybrid");
  const [mode, setMode] = React.useState<Mode>("create_campaign");

  const [autonomous, setAutonomous] = React.useState(true);

  const [url, setUrl] = React.useState("");
  const [campaignId, setCampaignId] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [niche, setNiche] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [trafficSource, setTrafficSource] = React.useState("");
  const [campaignType, setCampaignType] = React.useState("affiliate");
  const [notes, setNotes] = React.useState("");
  const [approvalMode, setApprovalMode] = React.useState<"required" | "auto_draft">("auto_draft");

  const [planOverride, setPlanOverride] = React.useState<string>("");
  const [approvedPlan, setApprovedPlan] = React.useState<Plan | null>(null);
  const [lastRun, setLastRun] = React.useState<RunResult | null>(null);
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);

  const planMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/ai-command/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          provider,
          mode,
          url: url || null,
          campaignId: campaignId || null,
          goal,
          niche: niche || null,
          audience: audience || null,
          trafficSource: trafficSource || null,
          campaignType: campaignType || null,
          notes: notes || null,
          approvalMode,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; plan: Plan };
    },
    onSuccess: (j) => {
      setApprovedPlan(null);
      setPlanOverride(JSON.stringify(j.plan, null, 2));
      toast.success("Plan generated");

      if (autonomous) {
        setApprovedPlan(j.plan);
        // Fire-and-forget execute; UI timeline will populate via run status polling.
        setTimeout(() => runMutation.mutate(), 0);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Plan failed"),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!approvedPlan) throw new Error("Approve a plan before executing");
      const res = await fetch("/api/admin/ai-command/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          provider,
          mode,
          url: url || null,
          campaignId: campaignId || null,
          goal,
          niche: niche || null,
          audience: audience || null,
          trafficSource: trafficSource || null,
          campaignType: campaignType || null,
          notes: notes || null,
          approvalMode,
          plan: approvedPlan,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const raw = (await res.json()) as Record<string, unknown>;
      return {
        ok: Boolean(raw.ok),
        runId: String(raw.runId ?? ""),
        plan: raw.plan as Plan,
        createdRecords: (raw.createdRecords as Record<string, unknown>) ?? {},
        updatedRecords: (raw.updatedRecords as Record<string, unknown>) ?? {},
        approvalItems: asRows<{ id: string; status: string; approval_type: string }>(raw.approvalItems),
        warnings: asStringArray(raw.warnings),
        errors: asStringArray(raw.errors),
      };
    },
    onSuccess: (j) => {
      setLastRun(j);
      setActiveRunId(j.runId);
      toast.success("Run completed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Run failed"),
  });

  const runStatusQuery = useQuery({
    queryKey: ["ai-command-run", organizationId, activeRunId],
    enabled: Boolean(activeRunId),
    refetchInterval: 2000,
    queryFn: async () => {
      const runId = activeRunId;
      if (!runId) return null;
      const res = await fetch(
        `/api/admin/ai-command/runs/${runId}?organizationId=${encodeURIComponent(organizationId)}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as Record<string, unknown>;
      return {
        ok: Boolean(j.ok),
        run: (j.run ?? null) as {
          id: string;
          status: string;
          output_summary: string | null;
          error_message: string | null;
        } | null,
        logs: asRows<{ id: string; created_at: string; level: string; message: string }>(j.logs),
        outputs: asRows<{ id: string; output_type: string; content: Record<string, unknown>; created_at: string }>(
          j.outputs,
        ),
        approvals: asRows<{ id: string; status: string; approval_type: string; created_at: string }>(j.approvals),
      };
    },
  });

  const parsedPlan = React.useMemo(() => {
    try {
      if (!planOverride.trim()) return null;
      return JSON.parse(planOverride) as Plan;
    } catch {
      return null;
    }
  }, [planOverride]);

  const canApprove = Boolean(
    parsedPlan && Array.isArray(parsedPlan.steps) && parsedPlan.steps.length > 0,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Org-scoped AI operator that plans and executes marketing workflows through safe internal tools.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Command</CardTitle>
          <CardDescription>Provide URL + goal + audience + traffic source. The agent handles the rest.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>URL (affiliate or client site)</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          </div>

          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(providerSchema.parse(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Pick provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openclaw">OpenClaw</SelectItem>
                <SelectItem value="internal_llm">Internal LLM</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(modeSchema.parse(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Pick mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create_campaign">Create new campaign</SelectItem>
                <SelectItem value="improve_campaign">Improve existing campaign</SelectItem>
                <SelectItem value="generate_content">Generate content</SelectItem>
                <SelectItem value="build_funnel">Build funnel</SelectItem>
                <SelectItem value="build_email_sequence">Build email sequence</SelectItem>
                <SelectItem value="analyze_performance">Analyze performance</SelectItem>
                <SelectItem value="create_ads">Create ads</SelectItem>
                <SelectItem value="setup_lead_capture">Setup lead capture</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode !== "create_campaign" ? (
            <div className="space-y-2 md:col-span-2">
              <Label>Campaign ID (for non-create modes)</Label>
              <Input
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                placeholder="campaign uuid"
              />
            </div>
          ) : null}

          <div className="space-y-2 md:col-span-2">
            <Label>Goal</Label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              placeholder="Generate leads and affiliate clicks from TikTok + YouTube Shorts."
            />
          </div>

          <div className="space-y-2">
            <Label>Niche</Label>
            <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="local SEO / real estate..." />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="small business owners" />
          </div>
          <div className="space-y-2">
            <Label>Traffic source</Label>
            <Input value={trafficSource} onChange={(e) => setTrafficSource(e.target.value)} placeholder="TikTok + Shorts" />
          </div>
          <div className="space-y-2">
            <Label>Campaign type</Label>
            <Input value={campaignType} onChange={(e) => setCampaignType(e.target.value)} placeholder="affiliate" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Approval mode</Label>
            <Select
              value={approvalMode}
              onValueChange={(v) => setApprovalMode(v === "required" ? "required" : "auto_draft")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick approval mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto_draft">Auto drafts (approve risky actions only)</SelectItem>
                <SelectItem value="required">Require approval before execution</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Autonomous</Label>
            <Select
              value={autonomous ? "on" : "off"}
              onValueChange={(v) => setAutonomous(v === "on")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on">On (auto-approve plan + execute)</SelectItem>
                <SelectItem value="off">Off (manual approve then execute)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end justify-end gap-2 md:col-span-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => planMutation.mutate()}
              disabled={planMutation.isPending || !goal.trim()}
            >
              {autonomous ? "Start autonomous run" : "Generate plan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan preview</CardTitle>
          <CardDescription>Edit if needed. Approve to execute.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={planOverride}
            onChange={(e) => setPlanOverride(e.target.value)}
            rows={14}
            placeholder="Click “Generate plan” to populate."
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!canApprove || !parsedPlan) return;
                setApprovedPlan(parsedPlan);
                toast.success("Plan approved");
              }}
              disabled={!canApprove}
            >
              Approve plan
            </Button>
            <Button
              type="button"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending || !approvedPlan}
            >
              Execute
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setApprovedPlan(null);
                setLastRun(null);
                setActiveRunId(null);
                toast.message("Cleared");
              }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execution timeline</CardTitle>
            <CardDescription>Live agent_logs for the run.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!runStatusQuery.data ? (
              <p className="text-sm text-muted-foreground">No run yet.</p>
            ) : (
              <div className="space-y-2">
                <div className="text-sm">
                  Status:{" "}
                  <span className="font-medium">{runStatusQuery.data.run?.status ?? "—"}</span>
                </div>
                <div className="max-h-[360px] overflow-auto rounded border border-border/60 p-3 space-y-2">
                  {runStatusQuery.data.logs.map((l) => (
                    <div key={l.id} className="text-xs">
                      <span className="text-muted-foreground">{new Date(l.created_at).toLocaleTimeString()} </span>
                      <span className="font-mono">{l.level}</span>{" "}
                      <span>{l.message}</span>
                    </div>
                  ))}
                  {runStatusQuery.data.logs.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No logs yet.</div>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results workspace</CardTitle>
            <CardDescription>Outputs + approvals created during execution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lastRun ? (
              <div className="rounded border border-border/60 p-3 text-sm space-y-1">
                <div>
                  Run: <span className="font-mono text-xs">{lastRun.runId}</span>
                </div>
                <div className="text-muted-foreground">
                  {asStringArray(lastRun.errors).length
                    ? `Errors: ${asStringArray(lastRun.errors).join(" · ")}`
                    : "No errors."}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No results yet.</p>
            )}

            {runStatusQuery.data ? (
              <>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Approvals</div>
                  {runStatusQuery.data.approvals.length ? (
                    <div className="space-y-1">
                      {runStatusQuery.data.approvals.map((a) => (
                        <div key={a.id} className="text-xs">
                          <span className="font-mono">{a.approval_type}</span>{" "}
                          <span className="text-muted-foreground">{a.status}</span>{" "}
                          <span className="font-mono text-[10px] text-muted-foreground">{a.id}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No approvals created.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Outputs</div>
                  {runStatusQuery.data.outputs.length ? (
                    <div className="space-y-2">
                      {runStatusQuery.data.outputs.map((o) => (
                        <div key={o.id} className="rounded border border-border/60 p-2">
                          <div className="text-xs font-mono text-muted-foreground">{o.output_type}</div>
                          <pre className="mt-1 overflow-auto text-[11px] leading-relaxed">
                            {JSON.stringify(o.content ?? {}, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No outputs yet.</p>
                  )}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

