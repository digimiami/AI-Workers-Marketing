"use client";

import Link from "next/link";
import { CheckCircle2, ChevronDown, Circle, Loader2, ShieldAlert, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExecutionStepUi } from "@/services/workspace/workspaceDisplayBundle";

function statusBadge(status: ExecutionStepUi["status"]) {
  switch (status) {
    case "complete":
      return <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Complete</Badge>;
    case "running":
      return <Badge variant="secondary" className="bg-sky-500/15 text-sky-700 dark:text-sky-300">Running</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "approval_needed":
      return <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-200">Approval</Badge>;
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

function statusIcon(status: ExecutionStepUi["status"]) {
  switch (status) {
    case "complete":
      return CheckCircle2;
    case "running":
      return Loader2;
    case "failed":
      return XCircle;
    case "approval_needed":
      return ShieldAlert;
    default:
      return Circle;
  }
}

export type TimelineLogLine = { id: string; level: string; message: string; created_at: string };

export function AiExecutionTimeline(props: {
  steps: ExecutionStepUi[];
  logs?: TimelineLogLine[];
  /** Optional links shown on each expanded row */
  campaignId?: string | null;
  pipelineRunId?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", props.className)}>
      {props.steps.map((step, idx) => {
        const Icon = statusIcon(step.status);
        const tone =
          step.status === "complete"
            ? "text-emerald-500"
            : step.status === "running"
              ? "text-sky-500"
              : step.status === "failed"
                ? "text-rose-500"
                : step.status === "approval_needed"
                  ? "text-amber-500"
                  : "text-muted-foreground";
        return (
          <details
            key={step.id}
            className="group rounded-xl border border-border/60 bg-background/40 backdrop-blur-sm transition-[box-shadow] open:shadow-md"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/60 text-xs font-semibold text-muted-foreground">
                {idx + 1}
              </div>
              <Icon className={cn("h-4 w-4 shrink-0", tone, step.status === "running" && "animate-spin")} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{step.title}</span>
                  {statusBadge(step.status)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                  Workers: {step.worker} · {step.creates}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/50 px-3 py-3 text-xs space-y-3 bg-muted/20">
              <div className="grid gap-1 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Creates</span>
                  <div className="font-medium">{step.creates}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Approval</span>
                  <div className="font-medium">{step.approval}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {props.campaignId ? (
                  <Link href={`/admin/campaigns/${props.campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Open campaign
                  </Link>
                ) : null}
                {props.pipelineRunId ? (
                  <Link
                    href={`/admin/workspace/review/run/${props.pipelineRunId}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Workspace summary
                  </Link>
                ) : null}
                <Link href="/admin/approvals" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Approvals queue
                </Link>
              </div>
              {props.logs && props.logs.length > 0 ? (
                <div>
                  <div className="mb-1 font-medium text-[11px] uppercase tracking-wide text-muted-foreground">Recent logs</div>
                  <div className="max-h-40 overflow-auto rounded-md border border-border/50 bg-background/60 p-2 font-mono text-[11px] space-y-1">
                    {props.logs.slice(-12).map((l) => (
                      <div key={l.id} className="whitespace-pre-wrap break-words">
                        <span className="text-muted-foreground">{new Date(l.created_at).toLocaleTimeString()}</span>{" "}
                        <span className={l.level === "error" ? "text-destructive" : ""}>{l.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
