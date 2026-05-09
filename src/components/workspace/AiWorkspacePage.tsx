"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { AiBuildStatus } from "@/components/workspace/AiBuildStatus";
import { AiBuildTimeline } from "@/components/workspace/AiBuildTimeline";
import { AiCommandCard, type AiCommandValues } from "@/components/workspace/AiCommandCard";
import { AiGeneratedResults } from "@/components/workspace/AiGeneratedResults";
import { AiWorkspaceFullGrid } from "@/components/workspace/AiWorkspaceFullGrid";
import { WorkspaceSavedRunsList } from "@/components/workspace/WorkspaceSavedRunsList";
import { PlanUpgradeDialog, parsePlanLimitMessage, type PlanKey, type PlanUpgradeReason } from "@/components/billing/PlanUpgradeDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLiveWorkspaceBuild } from "@/hooks/useLiveWorkspaceBuild";
import { cn } from "@/lib/utils";

type Props = {
  organizationId: string;
  runId?: string | null;
  redirectOnRunId?: boolean;
};

export function AiWorkspacePage(props: Props) {
  const { organizationId, runId: runIdProp, redirectOnRunId = false } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const live = useLiveWorkspaceBuild();

  const [cmd, setCmd] = React.useState<AiCommandValues>({
    url: "",
    goal: "",
    audience: "",
    trafficSource: "",
    funnelStyle: "clickfunnels_lead",
  });

  React.useEffect(() => {
    const u = searchParams.get("url");
    const g = searchParams.get("goal");
    const a = searchParams.get("audience");
    const t = searchParams.get("traffic") ?? searchParams.get("trafficSource");
    if (u) setCmd((c) => ({ ...c, url: u }));
    if (g) setCmd((c) => ({ ...c, goal: g }));
    if (a) setCmd((c) => ({ ...c, audience: a }));
    if (t) setCmd((c) => ({ ...c, trafficSource: t }));
  }, [searchParams]);

  const resumeRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!runIdProp) return;
    if (resumeRef.current === runIdProp) return;
    resumeRef.current = runIdProp;
    void live.resume(runIdProp);
    return () => {
      live.cancel();
      resumeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runIdProp]);

  React.useEffect(() => {
    if (!redirectOnRunId || !live.state.runId || runIdProp) return;
    if (typeof window === "undefined") return;
    const path = `/admin/workspace/${live.state.runId}`;
    if (window.location.pathname !== path) router.replace(path);
  }, [redirectOnRunId, runIdProp, router, live.state.runId]);

  /** New live build from `/admin/workspace/[runId]` yields a new run id — follow the new URL. */
  React.useEffect(() => {
    if (!runIdProp) return;
    const rid = live.state.runId;
    if (!rid || rid === runIdProp) return;
    router.replace(`/admin/workspace/${rid}`);
  }, [runIdProp, live.state.runId, router]);

  const campaignId = live.state.campaignId;
  const runId = live.state.runId;

  const onBuild = () => {
    void live.start({
      url: cmd.url.trim(),
      goal: cmd.goal.trim(),
      audience: cmd.audience.trim(),
      trafficSource: cmd.trafficSource.trim(),
      funnelStyle: cmd.funnelStyle ?? "clickfunnels_lead",
      provider: "hybrid",
      approvalMode: "auto_draft",
      mode: "affiliate",
    });
    toast.success("Live build started");
  };

  const onRegenerate = (section: "research" | "campaign" | "landing" | "funnel" | "content" | "ads" | "emails") => {
    void (async () => {
      try {
        toast.message(`Regenerating ${section}…`);
        await live.regenerateSection(section);
        toast.success(`${section} refreshed`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Regenerate failed");
      }
    })();
  };

  const showLive = live.state.active || live.state.runId || live.state.reviewUrl || Boolean(runIdProp);
  const ready =
    !live.state.active &&
    (live.state.finalStatus === "completed" || live.state.finalStatus === "complete" || live.state.reviewUrl);

  const stripeDisabled =
    (process.env.NEXT_PUBLIC_BILLING_DISABLE_STRIPE ?? "").toLowerCase() === "1" ||
    (process.env.NEXT_PUBLIC_BILLING_DISABLE_STRIPE ?? "").toLowerCase() === "true";

  const planSignal = React.useMemo<{ reason: PlanUpgradeReason; plan: PlanKey } | null>(() => {
    if (stripeDisabled) return null;
    for (const e of live.state.errors) {
      const hit = parsePlanLimitMessage(e.message);
      if (hit) return hit;
    }
    return null;
  }, [live.state.errors, stripeDisabled]);

  const [paywallOpen, setPaywallOpen] = React.useState(false);
  const [existingCampaignId, setExistingCampaignId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!stripeDisabled && planSignal) setPaywallOpen(true);
  }, [planSignal]);

  React.useEffect(() => {
    if (!planSignal || planSignal.reason !== "campaign_limit") return;
    let aborted = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/campaigns?organizationId=${encodeURIComponent(organizationId)}`);
        const j = (await res.json().catch(() => null)) as { ok?: boolean; campaigns?: Array<{ id: string }> };
        if (aborted || !j?.ok || !Array.isArray(j.campaigns) || j.campaigns.length === 0) return;
        setExistingCampaignId(j.campaigns[0].id);
      } catch {
        // silent — secondary action just won't show
      }
    })();
    return () => {
      aborted = true;
    };
  }, [planSignal, organizationId]);

  const friendlyError = React.useCallback((message: string) => {
    if (stripeDisabled) return message;
    const hit = parsePlanLimitMessage(message);
    if (!hit) return message;
    if (hit.reason === "campaign_limit") {
      return `You've reached the campaign limit on your ${hit.plan} plan. Upgrade or open your existing campaign to continue.`;
    }
    if (hit.reason === "ads_launch") {
      return `Paid ad launch is locked on your ${hit.plan} plan. Upgrade to unlock launch and optimization.`;
    }
    if (hit.reason === "ai_usage") {
      return `You've hit the monthly AI generation limit on your ${hit.plan} plan. Upgrade for higher limits.`;
    }
    return message;
  }, [stripeDisabled]);

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-20 mb-4 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {campaignId ? "AI Growth Engine" : "AI Workspace"}
            </div>
            <div className="truncate text-base font-semibold tracking-tight">
              {campaignId
                ? "Your AI Growth Engine is Live"
                : live.state.results.campaign?.name || (cmd.url ? cmd.url.replace(/^https?:\/\//, "") : "Live build")}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {campaignId ? (
              <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Campaign
              </Link>
            ) : null}
            {campaignId ? (
              <Link href={`/f/${campaignId}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Preview
              </Link>
            ) : null}
            {live.state.reviewUrl ? (
              <Link href={live.state.reviewUrl} className={buttonVariants({ variant: "default", size: "sm" })}>
                Approve
              </Link>
            ) : campaignId ? (
              <Link href={`/admin/workspace/review/${campaignId}`} className={buttonVariants({ variant: "default", size: "sm" })}>
                Approve
              </Link>
            ) : null}
          </div>
        </div>
        <AiBuildStatus active={live.state.active} finalStatus={live.state.finalStatus} progress={live.progress} className="rounded-none border-0 bg-transparent p-0 shadow-none" />
      </div>

      {!runIdProp ? <AiCommandCard value={cmd} onChange={setCmd} onSubmit={onBuild} disabled={live.state.active} /> : null}

      {!runIdProp ? (
        <div className="mt-4">
          <WorkspaceSavedRunsList
            variant="full"
            disabled={live.state.active}
            onRegenerate={(input) => {
              setCmd((c) => ({
                ...c,
                url: input.url,
                goal: input.goal,
                audience: input.audience,
                trafficSource: input.trafficSource,
                funnelStyle: input.funnelStyle ?? c.funnelStyle,
              }));
              void live.start(input);
            }}
          />
        </div>
      ) : null}

      {runIdProp ? (
        <div className="mb-4 mt-2">
          <WorkspaceSavedRunsList
            variant="compact"
            currentRunId={runIdProp}
            disabled={live.state.active}
            onRegenerate={(input) => {
              setCmd((c) => ({
                ...c,
                url: input.url,
                goal: input.goal,
                audience: input.audience,
                trafficSource: input.trafficSource,
                funnelStyle: input.funnelStyle ?? c.funnelStyle,
              }));
              void live.start(input);
            }}
          />
        </div>
      ) : null}

      {showLive ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="min-w-0">
              <AiBuildTimeline
                variant="stream"
                steps={live.state.steps}
                active={live.state.active}
                progress={live.progress}
                className="lg:sticky lg:top-[92px]"
              />
            </div>
            <div className="min-w-0">
              <AiGeneratedResults
                state={live.state}
                organizationId={organizationId}
                campaignId={campaignId}
                runId={runId}
                onRegenerate={onRegenerate}
                onStreamHint={(msg) => live.hintStep("ads", msg)}
                layout="grid"
              />
            </div>
          </div>

          {ready ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card p-6 shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]">
              <div className="text-2xl font-semibold tracking-tight">Your AI marketing workspace is ready.</div>
              <p className="mt-1 text-sm text-muted-foreground">Review, edit, approve, and launch — everything you need is below.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {campaignId ? (
                  <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ size: "default" })}>
                    Open campaign
                  </Link>
                ) : null}
                {campaignId ? (
                  <Link href={`/f/${campaignId}`} className={buttonVariants({ variant: "secondary", size: "default" })}>
                    Preview landing page
                  </Link>
                ) : null}
                {campaignId ? (
                  <Link href={`/admin/campaigns/${campaignId}?tab=content`} className={buttonVariants({ variant: "secondary", size: "default" })}>
                    View content
                  </Link>
                ) : null}
                {campaignId ? (
                  <Link href={`/admin/campaigns/${campaignId}?tab=emails`} className={buttonVariants({ variant: "outline", size: "default" })}>
                    Review emails
                  </Link>
                ) : null}
                {live.state.reviewUrl ? (
                  <Link href={live.state.reviewUrl} className={cn(buttonVariants({ variant: "default", size: "default" }), "gap-1")}>
                    Approve launch
                  </Link>
                ) : campaignId ? (
                  <Link href={`/admin/workspace/review/${campaignId}`} className={buttonVariants({ variant: "default", size: "default" })}>
                    Approve launch
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {live.state.errors.length ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
              {live.state.errors.map((e, i) => (
                <div key={i} className="whitespace-pre-wrap">
                  {friendlyError(e.message)}
                </div>
              ))}
              <div className="mt-3 flex flex-wrap gap-2">
                {planSignal ? (
                  <Button
                    variant="default"
                    className="border-rose-500/50"
                    onClick={() => setPaywallOpen(true)}
                  >
                    {planSignal.reason === "ads_launch" ? "Upgrade to launch ads" : "Upgrade plan"}
                  </Button>
                ) : null}
                {planSignal?.reason === "campaign_limit" && existingCampaignId ? (
                  <Link
                    href={`/admin/campaigns/${existingCampaignId}`}
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    Open existing campaign
                  </Link>
                ) : null}
                <Button
                  variant="outline"
                  className="border-rose-500/50"
                  disabled={!(live.state.runId ?? runIdProp) || Boolean(planSignal)}
                  onClick={() => {
                    const rid = live.state.runId ?? runIdProp;
                    if (rid) void live.resume(rid, { preserveResults: true });
                  }}
                >
                  Retry stream
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {planSignal ? (
        <PlanUpgradeDialog
          open={paywallOpen}
          onOpenChange={setPaywallOpen}
          organizationId={organizationId}
          reason={planSignal.reason}
          currentPlan={planSignal.plan}
          secondaryAction={
            planSignal.reason === "campaign_limit" && existingCampaignId
              ? {
                  label: "Open existing campaign",
                  onClick: () => router.push(`/admin/campaigns/${existingCampaignId}`),
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
