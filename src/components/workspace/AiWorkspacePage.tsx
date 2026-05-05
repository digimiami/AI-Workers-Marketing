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

  const [cmd, setCmd] = React.useState<AiCommandValues>({ url: "", goal: "", audience: "", trafficSource: "" });

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
    <div className="space-y-8 pb-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">AI Workspace</h1>
        <p className="text-sm text-muted-foreground">Watch AiWorkers build your campaign live.</p>
      </div>

      {!runIdProp ? <AiCommandCard value={cmd} onChange={setCmd} onSubmit={onBuild} disabled={live.state.active} /> : null}

      {showLive ? (
        <>
          <AiBuildStatus active={live.state.active} finalStatus={live.state.finalStatus} progress={live.progress} />

          <div className="grid gap-6 lg:grid-cols-[minmax(260px,360px)_1fr] lg:items-start">
            <div className="space-y-2 lg:sticky lg:top-4">
              <AiBuildTimeline steps={live.state.steps} active={live.state.active} progress={live.progress} />
            </div>
            <div className="min-w-0 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live generated results</h2>
              {live.state.active ? (
                <div className="flex items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/5 px-3 py-2 text-sm text-muted-foreground shadow-[0_0_24px_-8px_rgba(34,211,238,0.35)]">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                  </span>
                  <span className="animate-pulse">AI is building…</span>
                </div>
              ) : null}
              <AiGeneratedResults
                state={live.state}
                organizationId={organizationId}
                campaignId={campaignId}
                runId={runId}
                onRegenerate={onRegenerate}
                layout="stack"
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
                  <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "secondary", size: "default" })}>
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

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Full workspace grid</h2>
            <AiWorkspaceFullGrid
              state={live.state}
              organizationId={organizationId}
              campaignId={campaignId}
              runId={runId}
              onRegenerate={onRegenerate}
            />
          </div>

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
