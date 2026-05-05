"use client";

import { cn } from "@/lib/utils";

export function AiBuildStatus(props: {
  active: boolean;
  finalStatus: string | null;
  progress: number;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, props.progress)) * 100);
  const label = props.active
    ? "Building"
    : props.finalStatus === "completed" || props.finalStatus === "complete"
      ? "Ready"
      : props.finalStatus === "needs_approval"
        ? "Needs approval"
        : props.finalStatus === "failed"
          ? "Failed"
          : "Idle";

  const pill =
    props.active || !props.finalStatus
      ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
      : props.finalStatus === "completed" || props.finalStatus === "complete"
        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
        : props.finalStatus === "needs_approval"
          ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
          : props.finalStatus === "failed"
            ? "border-rose-500/40 bg-rose-500/15 text-rose-100"
            : "border-border/60 bg-muted/20 text-muted-foreground";

  return (
    <div className={cn("rounded-2xl border border-border/50 bg-card/40 p-4 shadow-[0_0_40px_-16px_rgba(34,211,238,0.35)] backdrop-blur-xl md:p-5", props.className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI Workspace status</div>
          <div className="mt-1 text-lg font-semibold tracking-tight">{props.active ? "Building your workspace…" : label}</div>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-xs font-medium", pill)}>{label}</span>
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-500 to-emerald-400 transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
