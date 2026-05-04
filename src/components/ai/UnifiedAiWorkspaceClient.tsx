"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Rocket, Sparkles } from "lucide-react";

import { AiLiveBuildStream } from "@/components/ai/AiLiveBuildStream";
import { AiWorkspaceLiveOutputGrid } from "@/components/ai/AiWorkspaceLiveOutputGrid";
import { AiWorkspaceThinkingPanel } from "@/components/ai/AiWorkspaceThinkingPanel";
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

type Props = {
  organizationId: string;
  /** When set, subscribe to an existing pipeline run (no build form). */
  runId?: string | null;
  /** New build: redirect browser to `/admin/workspace/[runId]` once the run id is known. */
  redirectOnRunId?: boolean;
};

export function UnifiedAiWorkspaceClient(props: Props) {
  const { organizationId: _organizationId, runId: runIdProp, redirectOnRunId = false } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const stream = useAiWorkspaceStream();

  const [url, setUrl] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [trafficSource, setTrafficSource] = React.useState("");

  React.useEffect(() => {
    const u = searchParams.get("url");
    const g = searchParams.get("goal");
    const a = searchParams.get("audience");
    const t = searchParams.get("traffic") ?? searchParams.get("trafficSource");
    if (u) setUrl(u);
    if (g) setGoal(g);
    if (a) setAudience(a);
    if (t) setTrafficSource(t);
  }, [searchParams]);

  const resumeStarted = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!runIdProp) return;
    if (resumeStarted.current === runIdProp) return;
    resumeStarted.current = runIdProp;
    stream.resume(runIdProp);
    return () => {
      stream.cancel();
      resumeStarted.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runIdProp]);

  React.useEffect(() => {
    if (!redirectOnRunId || !stream.state.runId || runIdProp) return;
    if (typeof window === "undefined") return;
    const path = `/admin/workspace/${stream.state.runId}`;
    if (window.location.pathname !== path) {
      router.replace(path);
    }
  }, [redirectOnRunId, runIdProp, router, stream.state.runId]);

  const canBuild = Boolean(url.trim() && goal.trim() && audience.trim() && trafficSource.trim());

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

  const resolvedCampaignId = stream.state.campaignId;

  const completedBuildSteps = stream.state.steps.filter((s) => s.key !== "done" && s.status === "complete").length;
  const progress =
    stream.state.active || completedBuildSteps > 0 ? completedBuildSteps / AI_WORKSPACE_BUILD_STEP_COUNT : 0;
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

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

  const showLive = stream.state.active || stream.state.runId || stream.state.reviewUrl;

  const statusLabel = stream.state.active
    ? "AI is building your workspace…"
    : stream.state.finalStatus === "completed" || stream.state.finalStatus === "complete"
      ? "Build complete"
      : stream.state.finalStatus === "needs_approval"
        ? "Awaiting approvals"
        : stream.state.finalStatus === "failed"
          ? "Build stopped with errors"
          : runIdProp
            ? "Workspace run"
            : "Ready to build";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">AI Workspace</h1>
        <p className="text-sm text-muted-foreground">
          One live surface for research, campaign, funnel, content, email, and launch — no jumping between admin pages.
        </p>
      </div>

      {!runIdProp ? (
        <Card className="glass-panel overflow-hidden border-border/60 shadow-lg">
          <div className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-transparent to-sky-500/10 px-4 py-3 md:px-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>URL · Goal · Audience · Traffic — everything else is automated.</span>
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
                <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder="What you want this workspace to achieve" />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Who this is for" />
              </div>
              <div className="space-y-2">
                <Label>Traffic</Label>
                <Input value={trafficSource} onChange={(e) => setTrafficSource(e.target.value)} placeholder="YouTube, TikTok, paid social…" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showLive ? (
        <>
          <Card className="border-border/60 bg-card/40 p-4 md:p-5 shadow-[0_0_40px_-16px_rgba(56,189,248,0.35)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</div>
                <div className="text-lg font-semibold tracking-tight">{statusLabel}</div>
                {runIdProp ? (
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    Run <span className="text-foreground/80">{runIdProp}</span>
                  </div>
                ) : null}
              </div>
              <div className="min-w-[140px] flex-1 md:max-w-sm">
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Progress</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-sky-500 to-cyan-400 transition-[width] duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          <AiWorkspaceThinkingPanel lines={stream.state.thinking} active={stream.state.active} />

          {!stream.state.active && stream.state.reviewUrl ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card p-6 shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]">
              <div className="text-2xl font-semibold tracking-tight">Your AI workspace is ready</div>
              <p className="mt-1 text-sm text-muted-foreground">Review assets, approve gated steps, or open modules below.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {resolvedCampaignId ? (
                  <Link href={`/admin/campaigns/${resolvedCampaignId}`} className={buttonVariants({ size: "default" })}>
                    Open campaign
                  </Link>
                ) : null}
                {resolvedCampaignId ? (
                  <Link href={`/admin/campaigns/${resolvedCampaignId}?tab=funnel`} className={buttonVariants({ variant: "secondary", size: "default" })}>
                    Edit funnel
                  </Link>
                ) : null}
                {resolvedCampaignId ? (
                  <Link href={`/admin/campaigns/${resolvedCampaignId}?tab=content`} className={buttonVariants({ variant: "secondary", size: "default" })}>
                    View content
                  </Link>
                ) : null}
                {resolvedCampaignId ? (
                  <Link href={`/admin/campaigns/${resolvedCampaignId}?tab=emails`} className={buttonVariants({ variant: "outline", size: "default" })}>
                    View emails
                  </Link>
                ) : null}
                {resolvedCampaignId ? (
                  <Link href={`/admin/ad-creative`} className={buttonVariants({ variant: "outline", size: "default" })}>
                    Launch ads
                  </Link>
                ) : null}
                {stream.state.reviewUrl ? (
                  <Link href={stream.state.reviewUrl} className={cn(buttonVariants({ variant: "outline", size: "default" }), "gap-1")}>
                    <Pencil className="h-4 w-4" />
                    Full review
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <AiWorkspaceLiveOutputGrid
            results={stream.state.results}
            steps={stream.state.steps}
            campaignId={resolvedCampaignId}
            modulePulseAt={stream.state.modulePulseAt}
            heading={!stream.state.active && stream.state.reviewUrl ? "Everything AI built" : "Live output"}
          />

          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Build timeline</h2>
            <AiLiveBuildStream
              steps={stream.state.steps}
              isRunning={stream.state.active}
              errors={stream.state.errors}
              progress={progress}
              onRetry={stream.retry}
              stepPreviews={stepPreviews}
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Full workspace</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {resolvedCampaignId ? (
                <Link
                  href={`/admin/campaigns/${resolvedCampaignId}`}
                  className="group rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-[0_0_28px_-8px_rgba(56,189,248,0.45)]"
                >
                  <div className="text-xs text-muted-foreground">Campaign</div>
                  <div className="mt-1 font-medium group-hover:text-primary">Open campaign hub</div>
                </Link>
              ) : null}
              {resolvedCampaignId ? (
                <Link
                  href={`/admin/campaigns/${resolvedCampaignId}?tab=funnel`}
                  className="group rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-[0_0_28px_-8px_rgba(56,189,248,0.45)]"
                >
                  <div className="text-xs text-muted-foreground">Funnel</div>
                  <div className="mt-1 font-medium group-hover:text-primary">Steps & flow</div>
                </Link>
              ) : null}
              {resolvedCampaignId ? (
                <Link
                  href={`/admin/campaigns/${resolvedCampaignId}?tab=content`}
                  className="group rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-[0_0_28px_-8px_rgba(56,189,248,0.45)]"
                >
                  <div className="text-xs text-muted-foreground">Content</div>
                  <div className="mt-1 font-medium group-hover:text-primary">Hooks & scripts</div>
                </Link>
              ) : null}
              {resolvedCampaignId ? (
                <Link
                  href={`/admin/campaigns/${resolvedCampaignId}?tab=emails`}
                  className="group rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-[0_0_28px_-8px_rgba(56,189,248,0.45)]"
                >
                  <div className="text-xs text-muted-foreground">Emails</div>
                  <div className="mt-1 font-medium group-hover:text-primary">Sequences</div>
                </Link>
              ) : null}
              {resolvedCampaignId ? (
                <Link
                  href={`/admin/analytics`}
                  className="group rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-[0_0_28px_-8px_rgba(56,189,248,0.45)]"
                >
                  <div className="text-xs text-muted-foreground">Analytics</div>
                  <div className="mt-1 font-medium group-hover:text-primary">Events & tracking</div>
                </Link>
              ) : null}
              <Link
                href="/admin/approvals"
                className="group rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-[0_0_28px_-8px_rgba(56,189,248,0.45)]"
              >
                <div className="text-xs text-muted-foreground">Approvals</div>
                <div className="mt-1 font-medium group-hover:text-primary">Review queue</div>
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
