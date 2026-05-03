"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, Loader2, Rocket, ShieldAlert, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PipelineStepper } from "@/components/ai/PipelineStepper";
import { cn } from "@/lib/utils";

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

type PlannerMeta = {
  used: boolean;
  provider: string;
  model?: string;
  baseUrl?: string;
  reason?: string;
  httpStatus?: number;
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

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

type MarketingPipelineRunApi = {
  ok: boolean;
  run?: Record<string, unknown>;
};

export function AiCommandCenterClient({ organizationId }: { organizationId: string }) {
  const router = useRouter();
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
  const [orgMode, setOrgMode] = React.useState<"existing" | "create">("existing");
  const [orgName, setOrgName] = React.useState("");
  const [cockpitStep, setCockpitStep] = React.useState<1 | 2>(1);

  const [planOverride, setPlanOverride] = React.useState<string>("");
  const [approvedPlan, setApprovedPlan] = React.useState<Plan | null>(null);
  const [lastRun, setLastRun] = React.useState<RunResult | null>(null);
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);
  const [activePipelineRunId, setActivePipelineRunId] = React.useState<string | null>(null);
  const [lastPipeline, setLastPipeline] = React.useState<{ pipelineRunId: string; campaignId: string | null } | null>(null);
  const [plannerMeta, setPlannerMeta] = React.useState<PlannerMeta | null>(null);

  const stageLabels = React.useMemo(
    () => ["Research", "Strategy", "Creation", "Execution"] as const,
    [],
  );

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
          notes: notes || undefined,
          approvalMode,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; plan: Plan; planner?: PlannerMeta };
    },
    onSuccess: (j) => {
      setApprovedPlan(null);
      setPlanOverride(JSON.stringify(j.plan, null, 2));
      setPlannerMeta(j.planner ?? null);
      toast.success("Plan generated");
      setCockpitStep(2);

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
          notes: notes || undefined,
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
        logs: asRows<{ id: string; created_at: string; level: string; message: string; data?: unknown }>(j.logs),
        outputs: asRows<{ id: string; output_type: string; content: Record<string, unknown>; created_at: string }>(
          j.outputs,
        ),
        approvals: asRows<{ id: string; status: string; approval_type: string; created_at: string }>(j.approvals),
      };
    },
  });

  const pipelineRunQuery = useQuery({
    queryKey: ["marketing-pipeline-run", activePipelineRunId],
    enabled: Boolean(activePipelineRunId),
    refetchInterval: (q) => {
      const st = String((q.state.data as MarketingPipelineRunApi | null | undefined)?.run?.status ?? "");
      return st === "running" || st === "pending" ? 2000 : false;
    },
    queryFn: async () => {
      const runId = activePipelineRunId;
      if (!runId) return null;
      const res = await fetch(`/api/admin/marketing-pipeline/runs/${runId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as MarketingPipelineRunApi;
    },
  });

  const pipelineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/marketing-pipeline/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationMode: orgMode,
          organizationId: orgMode === "existing" ? organizationId : undefined,
          organizationName: orgMode === "create" ? orgName : undefined,
          url,
          mode: campaignType === "client" ? "client" : "affiliate",
          goal,
          audience,
          trafficSource,
          notes: notes || undefined,
          provider,
          approvalMode,
          async: false,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as unknown;
    },
    onSuccess: (j) => {
      const out = asRecord(j);
      const runId = String(out.pipelineRunId ?? "");
      const cId = typeof out.campaignId === "string" && out.campaignId.length ? String(out.campaignId) : null;
      setActivePipelineRunId(runId || null);
      setLastPipeline(runId ? { pipelineRunId: runId, campaignId: cId } : null);
      if (cId) setCampaignId(cId);
      const errs = asStringArray(out.errors);
      const okFlag = out.ok !== false && errs.length === 0;
      if (okFlag) {
        toast.success("Pipeline run completed");
        if (runId) router.push(`/admin/workspace/review/run/${runId}`);
      } else {
        toast.error(errs.length ? errs.join(" · ") : "Pipeline finished with errors");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Pipeline run failed"),
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
  const canGeneratePlan = Boolean(
    url.trim() && goal.trim() && audience.trim() && trafficSource.trim() && (orgMode !== "create" || orgName.trim().length >= 2),
  );

  const planStageCards = React.useMemo(
    () => [
      { key: "research", title: "Research", worker: "Offer + competitor analysts", creates: "Offer summary, hooks, objections", approval: "No" },
      { key: "strategy", title: "Strategy", worker: "Head of marketing + planners", creates: "Campaign + funnel blueprint", approval: "No" },
      { key: "creation", title: "Build", worker: "Copy, design, email, ads", creates: "Landing, funnel, content, creatives", approval: "Drafts" },
      { key: "execution", title: "Launch prep", worker: "Tracking + lead capture", creates: "Forms, links, approvals", approval: "Publish gates" },
      { key: "optimization", title: "Optimize", worker: "Analytics + CRO", creates: "KPI baseline + tests", approval: "No" },
    ],
    [],
  );

  const applyQuickChip = (chip: string) => {
    const g = goal.trim();
    switch (chip) {
      case "affiliate":
        setCampaignType("affiliate");
        setMode("create_campaign");
        if (!g) setGoal("Drive affiliate clicks and conversions from paid social.");
        break;
      case "client":
        setCampaignType("client");
        setMode("create_campaign");
        if (!g) setGoal("Generate qualified leads for a client offer.");
        break;
      case "lead":
        setMode("create_campaign");
        if (!g) setGoal("Capture leads with a high-intent landing + nurture path.");
        break;
      case "shortform":
        setMode("generate_content");
        if (!g) setGoal("Produce short-form hooks and scripts for TikTok / Shorts / Reels.");
        break;
      case "nurture":
        setMode("build_email_sequence");
        if (!g) setGoal("Build an email nurture sequence after opt-in.");
        break;
      case "funnel":
        setMode("build_funnel");
        if (!g) setGoal("Design a bridge funnel from ad click to conversion.");
        break;
      case "ads":
        setMode("create_ads");
        if (!g) setGoal("Generate ad angles and primary text for paid channels.");
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI Command Center</h1>
        <p className="text-sm text-muted-foreground">URL → plan → build → live workspace with every module visible.</p>
      </div>

      <Card className="glass-panel border-border/60 overflow-hidden shadow-sm">
        <div className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-transparent to-sky-500/10 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>AI marketing cockpit</span>
            <span className="text-border">|</span>
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Risky publish/send actions stay approval‑gated.</span>
          </div>
        </div>
        <CardContent className="space-y-6 p-4 md:p-6">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Command</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste affiliate link or client website…"
              className="h-12 rounded-xl border-border/70 bg-background/80 text-base shadow-inner"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["affiliate", "Affiliate campaign"],
                ["client", "Client campaign"],
                ["lead", "Lead generation"],
                ["shortform", "Short-form content"],
                ["nurture", "Email nurture"],
                ["funnel", "Funnel build"],
                ["ads", "Ad creative"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => applyQuickChip(id)}
                className={cn(
                  "rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {cockpitStep === 1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Goal</Label>
                <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="Generate leads and affiliate clicks…" />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Small business owners" />
              </div>
              <div className="space-y-2">
                <Label>Traffic source</Label>
                <Input value={trafficSource} onChange={(e) => setTrafficSource(e.target.value)} placeholder="TikTok + YouTube Shorts" />
              </div>
              <details className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 md:col-span-2">
                <summary className="cursor-pointer select-none text-sm font-medium">Advanced</summary>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Campaign type</Label>
                    <Select value={campaignType} onValueChange={(v) => setCampaignType(v === "client" ? "client" : "affiliate")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick campaign type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="affiliate">Affiliate</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Approval mode</Label>
                    <Select value={approvalMode} onValueChange={(v) => setApprovalMode(v === "required" ? "required" : "auto_draft")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick approval mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto_draft">Auto drafts (risky actions only)</SelectItem>
                        <SelectItem value="required">Require approval before execution</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes (optional)</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                  </div>
                </div>
              </details>
              <div className="md:col-span-2 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!canGeneratePlan) return;
                    planMutation.mutate();
                  }}
                  disabled={!canGeneratePlan || planMutation.isPending}
                >
                  {planMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  <span className="ml-2">Generate plan</span>
                </Button>
                <Button type="button" onClick={() => setCockpitStep(2)} disabled={!canGeneratePlan}>
                  Skip to build preview
                  <ArrowRight className="ml-2 h-4 w-4 opacity-80" />
                </Button>
              </div>
            </div>
          ) : null}

          {cockpitStep === 2 ? (
            <div className="space-y-5">
              <PipelineStepper
                compact
                stages={[
                  { key: "research", status: planMutation.isSuccess || parsedPlan ? "completed" : "pending", summary: "URL + market scan" },
                  { key: "strategy", status: parsedPlan ? "completed" : "pending", summary: "Plan + worker routing" },
                  { key: "creation", status: "pending", summary: "Assets across modules" },
                  { key: "execution", status: approvalMode === "required" ? "needs_approval" : "pending", summary: "Tracking + approvals" },
                  { key: "optimization", status: "pending", summary: "Measurement + tests" },
                ]}
              />

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">AI plan</h3>
                  {plannerMeta ? (
                    <span className="text-[11px] text-muted-foreground">
                      {plannerMeta.used ? `Model · ${plannerMeta.model ?? ""}` : "Planner fallback"}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {planStageCards.map((s) => (
                    <Card key={s.key} className="border-border/60 bg-background/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{s.title}</CardTitle>
                        <CardDescription className="text-[11px] space-y-1">
                          <div>
                            <span className="font-medium text-foreground/90">Worker:</span> {s.worker}
                          </div>
                          <div>
                            <span className="font-medium text-foreground/90">Creates:</span> {s.creates}
                          </div>
                          <div>
                            <span className="font-medium text-foreground/90">Approval:</span> {s.approval}
                          </div>
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>

              {parsedPlan?.steps?.length ? (
                <div className="rounded-xl border border-border/60 bg-muted/15 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detailed steps</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {parsedPlan.steps.map((st, i) => (
                      <div key={`${st.name}-${i}`} className="rounded-lg border border-border/50 bg-card/60 p-2 text-xs">
                        <div className="font-medium">{st.name}</div>
                        <div className="mt-1 text-muted-foreground">
                          Outputs: {st.records_to_create?.join(", ") || "—"}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          Tools: {(st.tools_needed ?? []).slice(0, 4).join(", ")}
                          {(st.tools_needed?.length ?? 0) > 4 ? "…" : ""}
                        </div>
                        <div className="mt-1">
                          {st.approval_required ? (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                              Approval required
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">No approval</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {parsedPlan.expected_outputs?.length ? (
                    <div className="text-[11px] text-muted-foreground">
                      Est. outputs: {parsedPlan.expected_outputs.join(" · ")}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Generate a plan from step 1 to see worker-level detail here.</p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
                <Button variant="secondary" type="button" onClick={() => setCockpitStep(1)}>
                  Back
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => planMutation.mutate()}
                    disabled={planMutation.isPending || !canGeneratePlan}
                  >
                    Regenerate plan
                  </Button>
                  <Button
                    type="button"
                    onClick={() => pipelineMutation.mutate()}
                    disabled={pipelineMutation.isPending || !canGeneratePlan}
                    className="min-w-[200px]"
                  >
                    {pipelineMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    <span className="ml-2">Build AI workspace</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <details className="rounded-xl border border-border/60 bg-card/40 px-3 py-2">
        <summary className="cursor-pointer select-none text-sm font-medium">
          Advanced / legacy tools
        </summary>
        <div className="mt-3 space-y-6">
          <div className="grid gap-3 md:grid-cols-4">
            {stageLabels.map((label) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{label}</CardTitle>
                  <CardDescription className="text-xs">
                    {label === "Research"
                      ? "Analyze URL + inputs"
                      : label === "Strategy"
                        ? "Plan workflow + approvals"
                        : label === "Creation"
                          ? "Draft funnel/content/email/ads"
                          : "Create approvals + handoff"}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Command</CardTitle>
          <CardDescription>Fill the basics. Use Advanced only if you need it.</CardDescription>
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
            <Label>Workflow</Label>
            <Select value={mode} onValueChange={(v) => setMode(modeSchema.parse(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Pick mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create_campaign">Build everything (campaign + funnel + content + email)</SelectItem>
                <SelectItem value="improve_campaign">Improve existing campaign</SelectItem>
                <SelectItem value="build_funnel">Build funnel</SelectItem>
                <SelectItem value="generate_content">Generate content</SelectItem>
                <SelectItem value="build_email_sequence">Build email sequence</SelectItem>
                <SelectItem value="create_ads">Create ads</SelectItem>
                <SelectItem value="setup_lead_capture">Setup lead capture</SelectItem>
                <SelectItem value="analyze_performance">Analyze performance</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
            <Label>Audience</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="small business owners" />
          </div>
          <div className="space-y-2">
            <Label>Traffic source</Label>
            <Input value={trafficSource} onChange={(e) => setTrafficSource(e.target.value)} placeholder="TikTok + Shorts" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="md:col-span-2">
            <details className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
              <summary className="cursor-pointer select-none text-sm font-medium">
                Advanced (optional)
              </summary>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {mode !== "create_campaign" ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Campaign ID</Label>
                    <Input
                      value={campaignId}
                      onChange={(e) => setCampaignId(e.target.value)}
                      placeholder="campaign uuid"
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>Niche</Label>
                  <Input
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="local SEO / real estate..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Campaign type</Label>
                  <Input value={campaignType} onChange={(e) => setCampaignType(e.target.value)} placeholder="affiliate" />
                </div>
              </div>
            </details>
          </div>

          <div className="space-y-2">
            <Label>Organization</Label>
            <Select value={orgMode} onValueChange={(v) => setOrgMode(v === "create" ? "create" : "existing")}>
              <SelectTrigger>
                <SelectValue placeholder="Pick org mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="existing">Use current organization</SelectItem>
                <SelectItem value="create">Create new organization</SelectItem>
              </SelectContent>
            </Select>
            {orgMode === "create" ? (
              <div className="pt-2">
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="New organization name"
                />
              </div>
            ) : (
              <div className="pt-2 text-xs text-muted-foreground">
                Using org <span className="font-mono">{organizationId}</span>
              </div>
            )}
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
            <Button
              type="button"
              onClick={() => pipelineMutation.mutate()}
              disabled={pipelineMutation.isPending || !url.trim() || !goal.trim() || !audience.trim() || !trafficSource.trim() || (orgMode === "create" && orgName.trim().length < 2)}
            >
              Run Marketing Pipeline
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan preview</CardTitle>
          <CardDescription>Edit if needed. In Autonomous mode, the plan is auto-approved and executed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {plannerMeta ? (
            <div className="rounded border border-border/60 bg-card/40 p-2 text-xs">
              <span className="font-medium">Planner:</span>{" "}
              {plannerMeta.used ? (
                <span>
                  OpenAI ({plannerMeta.model ?? "model"}){" "}
                  <span className="text-muted-foreground">
                    {plannerMeta.baseUrl ? `· ${plannerMeta.baseUrl}` : ""}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Fallback {plannerMeta.httpStatus ? `(HTTP ${plannerMeta.httpStatus})` : ""}
                  {plannerMeta.reason ? ` · ${plannerMeta.reason}` : ""}
                </span>
              )}
            </div>
          ) : null}
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
            {(() => {
              const rs = runStatusQuery.data;
              if (!rs) {
                return <p className="text-sm text-muted-foreground">No run yet.</p>;
              }
              return (
                <div className="space-y-2">
                  <div className="text-sm">
                    Status: <span className="font-medium">{rs.run?.status ?? "—"}</span>
                  </div>
                  <div className="max-h-[360px] overflow-auto rounded border border-border/60 p-3 space-y-2">
                    {rs.logs.map((l, idx) => {
                      const denom = Math.max(1, rs.logs.length - 1);
                      const p = idx / denom;
                      const stage =
                        p >= 0.75
                          ? "Execution"
                          : p >= 0.5
                            ? "Creation"
                            : p >= 0.25
                              ? "Strategy"
                              : "Research";
                      return (
                        <div key={l.id} className="text-xs">
                          <span className="text-muted-foreground">
                            {new Date(l.created_at).toLocaleTimeString()}{" "}
                          </span>
                          <span className="font-mono">{l.level}</span>{" "}
                          <span>{l.message}</span>{" "}
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {stage}
                          </span>
                          {l.level === "error" ? (
                            <div className="mt-1 text-[11px] text-destructive">
                              {(() => {
                                const d = asRecord(l.data);
                                const err = typeof d.error === "string" ? d.error : "";
                                return err ? `Error: ${err}` : "";
                              })()}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {rs.logs.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No logs yet.</div>
                    ) : null}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results workspace</CardTitle>
            <CardDescription>Outputs + approvals created during execution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
          {lastPipeline ? (
            <div className="rounded border border-border/60 p-3 text-sm space-y-1">
              <div>
                Pipeline run: <span className="font-mono text-xs">{lastPipeline.pipelineRunId}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lastPipeline.campaignId ? (
                  <>
                    <Link
                      href={`/admin/campaigns/${lastPipeline.campaignId}`}
                      className="text-sm underline underline-offset-4"
                    >
                      Campaign
                    </Link>
                    <span className="text-muted-foreground">·</span>
                    <Link
                      href={`/admin/campaigns/${lastPipeline.campaignId}/pipeline`}
                      className="text-sm underline underline-offset-4"
                    >
                      Campaign pipeline
                    </Link>
                    <span className="text-muted-foreground">·</span>
                    <Link
                      href={`/f/${lastPipeline.campaignId}`}
                      className="text-sm underline underline-offset-4"
                    >
                      Public funnel
                    </Link>
                  </>
                ) : (
                  <span className="text-muted-foreground">Campaign not created yet.</span>
                )}
                <span className="text-muted-foreground">·</span>
                <Link href="/admin/approvals" className="text-sm underline underline-offset-4">
                  Approvals
                </Link>
              </div>
              {(() => {
                const pr = asRecord(pipelineRunQuery.data);
                const run = asRecord(pr.run);
                const status = typeof run.status === "string" ? run.status : null;
                if (!status) return null;
                return (
                <div className="text-xs text-muted-foreground">
                  Status: <span className="font-mono">{String(status)}</span>
                </div>
                );
              })()}
            </div>
          ) : null}

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
                {(() => {
                  // If internal/hybrid ran full provisioning, it writes ids into ai.artifacts output.
                  const artifacts = runStatusQuery.data.outputs.find((o) => o.output_type === "ai.artifacts");
                  const content = asRecord(artifacts?.content);
                  const updated = asRecord(content.updatedRecords);
                  const prov = asRecord(asRecord(content.createdRecords).provisioning);

                  const campaignId = (updated.campaign_id as string | undefined) ?? (prov.campaignId as string | undefined);
                  const funnelId = (updated.funnel_id as string | undefined) ?? (prov.funnelId as string | undefined);
                  const emailSequenceId =
                    (updated.email_sequence_id as string | undefined) ?? (prov.emailSequenceId as string | undefined);

                  const contentCount = Array.isArray(prov.contentAssetIds) ? prov.contentAssetIds.length : null;
                  const templateCount = Array.isArray(prov.emailTemplateIds) ? prov.emailTemplateIds.length : null;
                  const approvalsCount = Array.isArray(prov.approvalIds) ? prov.approvalIds.length : null;

                  if (!campaignId && !funnelId && !emailSequenceId) return null;

                  return (
                    <div className="rounded border border-border/60 p-3 space-y-2">
                      <div className="text-sm font-medium">Open created modules</div>
                      <div className="flex flex-wrap gap-2">
                        {campaignId ? (
                          <>
                            <Link
                              href={`/admin/workspace/review/${campaignId}`}
                              className="text-sm underline underline-offset-4"
                            >
                              Workspace Review
                            </Link>
                            <span className="text-muted-foreground">·</span>
                            <Link
                              href={`/admin/campaigns/${campaignId}`}
                              className="text-sm underline underline-offset-4"
                            >
                              Campaign
                            </Link>
                            <span className="text-muted-foreground">·</span>
                            <Link
                              href={`/f/${campaignId}`}
                              className="text-sm underline underline-offset-4"
                            >
                              Public funnel
                            </Link>
                          </>
                        ) : null}
                        <span className="text-muted-foreground">·</span>
                        <Link
                          href={`/admin/ai-workers/runs/${activeRunId ?? ""}`}
                          className="text-sm underline underline-offset-4"
                        >
                          Run detail
                        </Link>
                        <span className="text-muted-foreground">·</span>
                        <Link href="/admin/funnels" className="text-sm underline underline-offset-4">
                          Funnels{funnelId ? " (created)" : ""}
                        </Link>
                        <span className="text-muted-foreground">·</span>
                        <Link href="/admin/content" className="text-sm underline underline-offset-4">
                          Content{typeof contentCount === "number" ? ` (${contentCount})` : ""}
                        </Link>
                        <span className="text-muted-foreground">·</span>
                        <Link href="/admin/email" className="text-sm underline underline-offset-4">
                          Email{typeof templateCount === "number" ? ` (${templateCount} templates)` : ""}
                        </Link>
                        <span className="text-muted-foreground">·</span>
                        <Link href="/admin/approvals" className="text-sm underline underline-offset-4">
                          Approvals{typeof approvalsCount === "number" ? ` (${approvalsCount})` : ""}
                        </Link>
                      </div>
                      {emailSequenceId ? (
                        <div className="text-xs text-muted-foreground">
                          Email sequence: <span className="font-mono">{emailSequenceId}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

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
      </details>
    </div>
  );
}

