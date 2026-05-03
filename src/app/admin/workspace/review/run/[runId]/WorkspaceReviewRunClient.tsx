"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { AiExecutionTimeline } from "@/components/ai/AiExecutionTimeline";
import { GeneratedWorkspaceResults } from "@/components/ai/GeneratedWorkspaceResults";
import { PipelineStepper } from "@/components/ai/PipelineStepper";
import { buttonVariants } from "@/components/ui/button";
import type { ExecutionStepUi } from "@/services/workspace/workspaceDisplayBundle";
import type { WorkspaceDisplayBundle } from "@/services/workspace/workspaceDisplayBundle";

type RunApi = {
  ok: boolean;
  run?: Record<string, unknown>;
  workspaceDisplay?: WorkspaceDisplayBundle | null;
  runTimeline?: { steps: ExecutionStepUi[] };
};

export function WorkspaceReviewRunClient({ organizationId, runId }: { organizationId: string; runId: string }) {
  const q = useQuery({
    queryKey: ["marketing-pipeline-run-review", runId],
    refetchInterval: (query) => {
      const st = String((query.state.data as RunApi | undefined)?.run?.status ?? "");
      return st === "running" || st === "pending" ? 2000 : false;
    },
    queryFn: async () => {
      const res = await fetch(`/api/admin/marketing-pipeline/runs/${runId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as RunApi;
    },
  });

  const run = (q.data?.run ?? null) as Record<string, unknown> | null;
  const campaignId = run?.campaign_id ? String(run.campaign_id) : null;
  const bundle = (q.data?.workspaceDisplay ?? null) as WorkspaceDisplayBundle | null;
  const steps = q.data?.runTimeline?.steps ?? [];

  const stages = (run?.stages as Array<{ stage_key: string; status: string; output_summary?: string | null }> | undefined) ?? [];
  const stepperStages = ["research", "strategy", "creation", "execution", "optimization"].map((key) => {
    const row = stages.find((s) => s.stage_key === key);
    const raw = String(row?.status ?? "pending");
    const status =
      raw === "completed"
        ? ("completed" as const)
        : raw === "failed"
          ? ("failed" as const)
          : raw === "needs_approval"
            ? ("needs_approval" as const)
            : raw === "running"
              ? ("running" as const)
              : ("pending" as const);
    return {
      key: key as "research" | "strategy" | "creation" | "execution" | "optimization",
      status,
      summary: row?.output_summary ?? null,
    };
  });

  const logs = (run?.logs as Array<{ id: string; level: string; message: string; created_at: string }> | undefined) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/admin/ai-command" className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 gap-1" })}>
            <ArrowLeft className="h-4 w-4" />
            AI Command
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Workspace build summary</h1>
          <p className="text-sm text-muted-foreground">
            Run <span className="font-mono text-xs">{runId}</span>
            {campaignId ? (
              <>
                {" "}
                · campaign <span className="font-mono text-xs">{campaignId}</span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          className={buttonVariants({ variant: "outline", size: "sm" })}
          onClick={() => q.refetch()}
          disabled={q.isFetching}
        >
          <RefreshCw className={q.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </button>
      </div>

      {q.isError ? <p className="text-sm text-destructive">Could not load this run.</p> : null}

      <div className="rounded-xl border border-border/60 bg-card/30 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium">{run ? String(run.status) : q.isLoading ? "…" : "—"}</span>
          {run?.current_stage ? (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Stage</span>
              <span className="font-mono text-xs">{String(run.current_stage)}</span>
            </>
          ) : null}
        </div>
        <div className="mt-3">
          <PipelineStepper compact stages={stepperStages} />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Live execution</h2>
        <AiExecutionTimeline steps={steps} logs={logs} campaignId={campaignId} pipelineRunId={runId} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Created modules</h2>
        <GeneratedWorkspaceResults
          bundle={bundle}
          organizationId={organizationId}
          campaignId={campaignId}
          pipelineRunId={runId}
        />
      </section>

      {campaignId ? (
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "default" })}>
            Open campaign workspace
          </Link>
          <Link href={`/admin/workspace/review/${campaignId}`} className={buttonVariants({ variant: "outline" })}>
            Legacy review (by campaign)
          </Link>
        </div>
      ) : null}
    </div>
  );
}
