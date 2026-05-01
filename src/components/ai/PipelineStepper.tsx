"use client";

import * as React from "react";

import { CheckCircle2, Circle, Clock, Loader2, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type PipelineStageKey = "research" | "strategy" | "creation" | "execution" | "optimization";
export type PipelineStageStatus = "pending" | "running" | "completed" | "failed" | "needs_approval";

const LABELS: Record<PipelineStageKey, string> = {
  research: "Research",
  strategy: "Strategy",
  creation: "Creation",
  execution: "Execution",
  optimization: "Optimization",
};

function statusIcon(status: PipelineStageStatus) {
  switch (status) {
    case "completed":
      return CheckCircle2;
    case "running":
      return Loader2;
    case "needs_approval":
      return ShieldAlert;
    case "failed":
      return Circle;
    default:
      return Clock;
  }
}

export function PipelineStepper(props: {
  stages: Array<{ key: PipelineStageKey; status: PipelineStageStatus; summary?: string | null }>;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-background/40 p-3 glass-panel", props.className)}>
      <div className={cn("grid gap-2", props.compact ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-1 sm:grid-cols-5")}>
        {props.stages.map((s) => {
          const Icon = statusIcon(s.status);
          const tone =
            s.status === "completed"
              ? "text-emerald-500"
              : s.status === "running"
                ? "text-sky-500"
                : s.status === "needs_approval"
                  ? "text-amber-500"
                  : s.status === "failed"
                    ? "text-rose-500"
                    : "text-muted-foreground";
          return (
            <div key={s.key} className="rounded-lg border border-border/50 bg-background/30 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium">{LABELS[s.key]}</div>
                <Icon className={cn("h-4 w-4", tone, s.status === "running" && "animate-spin")} />
              </div>
              <div className={cn("mt-1 text-[11px] capitalize", tone)}>{s.status.replace("_", " ")}</div>
              {props.compact ? null : s.summary ? (
                <div className="mt-2 text-[11px] text-muted-foreground line-clamp-2">{s.summary}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

