"use client";

import * as React from "react";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Pencil, Rocket, Sparkles } from "lucide-react";

import { AiLiveBuildStream } from "@/components/ai/AiLiveBuildStream";
import { AiWorkspaceResultsPanel } from "@/components/ai/AiWorkspaceResultsPanel";
import {
  AdsCard,
  AnalyticsCard,
  ApprovalCard,
  CampaignCard,
  ContentCard,
  EmailCard,
  FunnelCard,
  LandingCard,
  LeadCaptureCard,
  ResearchCard,
} from "@/components/ai/workspace";
import { AI_WORKSPACE_BUILD_STEP_COUNT, useAiWorkspaceStream } from "@/components/ai/useAiWorkspaceStream";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function AiCommandCenterClient({ organizationId }: { organizationId: string }) {
  const searchParams = useSearchParams();
  const stream = useAiWorkspaceStream();

  const [url, setUrl] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [trafficSource, setTrafficSource] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [provider, setProvider] = React.useState<Provider>("hybrid");
  const [mode, setMode] = React.useState<Mode>("create_campaign");
  const [campaignId, setCampaignId] = React.useState("");
  const [planOverride, setPlanOverride] = React.useState("");
  const [approvedPlan, setApprovedPlan] = React.useState<Plan | null>(null);
  React.useEffect(() => {
    const cid = searchParams.get("campaignId");
    const prompt = searchParams.get("prompt");
    if (cid) setCampaignId(cid);
    if (prompt) setNotes((n) => n || prompt);
  }, [searchParams]);

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
          niche: null,
          audience: audience || null,
          trafficSource: trafficSource || null,
          campaignType: "affiliate",
          notes: notes || undefined,
          approvalMode: "auto_draft",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; plan: Plan };
    },
    onSuccess: (j) => {
      setApprovedPlan(null);
      setPlanOverride(JSON.stringify(j.plan, null, 2));
      toast.success("Plan generated");
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
          niche: null,
          audience: audience || null,
          trafficSource: trafficSource || null,
          campaignType: "affiliate",
          notes: notes || undefined,
          approvalMode: "auto_draft",
          plan: approvedPlan,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as Record<string, unknown>;
    },
    onSuccess: () => toast.success("Legacy run completed"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Run failed"),
  });

  const canBuild = Boolean(url.trim() && goal.trim() && audience.trim() && trafficSource.trim());

  const resolvedCampaignId = stream.state.campaignId ?? (campaignId.trim() || null);

  const startStreamBuild = () => {
    if (!canBuild) return;
    stream.start({
      url: url.trim(),
      goal: goal.trim(),
      audience: audience.trim(),
      trafficSource: trafficSource.trim(),
      provider: "hybrid",
      approvalMode: "auto_draft",
      mode: "affiliate",
    });
    toast.success("Building workspace — streaming live.");
  };

  const completedBuildSteps = stream.state.steps.filter((s) => s.key !== "done" && s.status === "complete").length;
  const progress = stream.state.active || completedBuildSteps > 0 ? completedBuildSteps / AI_WORKSPACE_BUILD_STEP_COUNT : 0;

  const stepPreviews = React.useMemo(() => {
    const r = stream.state.results;
    const cid = resolvedCampaignId;
    const mini = "border-0 bg-transparent shadow-none";
    return {
      research: r.research ? <ResearchCard data={r.research} className={mini} /> : undefined,
      campaign: r.campaign ? <CampaignCard data={r.campaign} campaignId={cid} className={mini} /> : undefined,
      landing: r.landing ? <LandingCard data={r.landing} campaignId={cid} className={mini} /> : undefined,
      funnel: r.funnel ? <FunnelCard data={r.funnel} campaignId={cid} className={mini} /> : undefined,
      content: r.content ? <ContentCard data={r.content} campaignId={cid} className={mini} /> : undefined,
      ads: r.ads ? <AdsCard data={r.ads} campaignId={cid} className={mini} /> : undefined,
      emails: r.emails ? <EmailCard data={r.emails} campaignId={cid} className={mini} /> : undefined,
      lead_capture: r.leadCapture ? <LeadCaptureCard data={r.leadCapture} className={mini} /> : undefined,
      analytics: r.analytics ? <AnalyticsCard data={r.analytics} className={mini} /> : undefined,
      approvals: r.approvals ? <ApprovalCard data={r.approvals} campaignId={cid} className={mini} /> : undefined,
    } as Partial<Record<string, React.ReactNode>>;
  }, [stream.state.results, resolvedCampaignId]);

  const showWorkspace = stream.state.active || stream.state.runId || stream.state.reviewUrl;

  const parsedPlan = React.useMemo(() => {
    try {
      if (!planOverride.trim()) return null;
      return JSON.parse(planOverride) as Plan;
    } catch {
      return null;
    }
  }, [planOverride]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI Workspace Builder</h1>
        <p className="text-sm text-muted-foreground">
          Paste URL → Generate → watch the live build → edit or approve when ready.
        </p>
      </div>

      <Card className="glass-panel overflow-hidden border-border/60 shadow-lg">
        <div className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-transparent to-sky-500/10 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Real-time marketing workspace</span>
          </div>
        </div>
        <CardContent className="space-y-5 p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com or example.com"
                className="h-12 rounded-xl border-border/70 bg-background/80 text-base shadow-inner"
              />
            </div>
            <Button type="button" onClick={startStreamBuild} disabled={stream.state.active || !canBuild} className="h-12 rounded-xl px-6">
              {stream.state.active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              <span className="ml-2">Build workspace</span>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Goal</Label>
              <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder="e.g. Generate qualified leads" />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Who you are targeting" />
            </div>
            <div className="space-y-2">
              <Label>Traffic</Label>
              <Input value={trafficSource} onChange={(e) => setTrafficSource(e.target.value)} placeholder="YouTube, TikTok, email…" />
            </div>
          </div>
        </CardContent>
      </Card>

      {showWorkspace ? (
        <>
          {!stream.state.active && stream.state.reviewUrl ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card p-6 shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]">
              <div className="text-2xl font-semibold tracking-tight">Workspace ready</div>
              <p className="mt-1 text-sm text-muted-foreground">Your AI build finished. Open the campaign or continue in the full workspace.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {resolvedCampaignId ? (
                  <Link href={`/admin/campaigns/${resolvedCampaignId}`} className={buttonVariants({ size: "default" })}>
                    Open campaign
                  </Link>
                ) : null}
                {stream.state.reviewUrl ? (
                  <Link href={stream.state.reviewUrl} className={buttonVariants({ variant: "secondary", size: "default" })}>
                    View full workspace
                  </Link>
                ) : null}
                {resolvedCampaignId ? (
                  <Link
                    href={`/admin/campaigns/${resolvedCampaignId}`}
                    className={cn(buttonVariants({ variant: "outline", size: "default" }), "gap-1")}
                  >
                    <Pencil className="h-4 w-4" />
                    Continue editing
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {stream.state.active || (showWorkspace && progress > 0) ? (
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Overall progress</span>
                <span>{Math.round(Math.min(1, progress) * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-sky-500 to-cyan-400 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.round(Math.min(1, progress) * 100))}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
            <AiLiveBuildStream
              steps={stream.state.steps}
              isRunning={stream.state.active}
              errors={stream.state.errors}
              progress={progress}
              onRetry={stream.retry}
              stepPreviews={stepPreviews}
            />
            <AiWorkspaceResultsPanel results={stream.state.results} campaignId={resolvedCampaignId} />
          </div>
        </>
      ) : null}

      <details className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
        <summary className="cursor-pointer select-none text-sm font-medium">Advanced · planner & legacy execute</summary>
        <div className="mt-4 space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            Optional: generate a structured plan or run the legacy AI-command executor. The workspace builder above uses the marketing pipeline stream.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Provider</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={provider}
                onChange={(e) => setProvider(providerSchema.parse(e.target.value))}
              >
                <option value="hybrid">Hybrid</option>
                <option value="openclaw">OpenClaw</option>
                <option value="internal_llm">Internal LLM</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Workflow</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={mode}
                onChange={(e) => setMode(modeSchema.parse(e.target.value))}
              >
                <option value="create_campaign">Create campaign</option>
                <option value="improve_campaign">Improve campaign</option>
                <option value="build_funnel">Build funnel</option>
                <option value="generate_content">Generate content</option>
                <option value="build_email_sequence">Email sequence</option>
                <option value="create_ads">Ads</option>
                <option value="setup_lead_capture">Lead capture</option>
                <option value="analyze_performance">Analyze</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs">Campaign ID (optional)</Label>
              <Input value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="UUID when improving an existing campaign" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => planMutation.mutate()} disabled={!goal.trim() || planMutation.isPending}>
              {planMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Generate plan
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!parsedPlan) return;
                setApprovedPlan(parsedPlan);
                toast.success("Plan approved for legacy run");
              }}
              disabled={!parsedPlan}
            >
              Approve plan
            </Button>
            <Button type="button" onClick={() => runMutation.mutate()} disabled={!approvedPlan || runMutation.isPending}>
              Execute (legacy)
            </Button>
          </div>
          <Textarea
            value={planOverride}
            onChange={(e) => setPlanOverride(e.target.value)}
            rows={8}
            className="font-mono text-xs"
            placeholder="Plan JSON appears here after “Generate plan”."
          />
        </div>
      </details>
    </div>
  );
}
