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
                <div key={i}>{e.message}</div>
              ))}
              <Button
                variant="outline"
                className="mt-3 border-rose-500/50"
                disabled={!(live.state.runId ?? runIdProp)}
                onClick={() => {
                  const rid = live.state.runId ?? runIdProp;
                  if (rid) void live.resume(rid, { preserveResults: true });
                }}
              >
                Retry stream
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
