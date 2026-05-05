"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiveBuildStepKey, LiveBuildStepStatus } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function AiBuildTimeline(props: {
  steps: Array<{ key: LiveBuildStepKey; label: string; status: LiveBuildStepStatus; message?: string }>;
  active: boolean;
  progress: number;
  variant?: "timeline" | "stream";
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, props.progress)) * 100);
  const variant = props.variant ?? "timeline";

  const feedRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (variant !== "stream") return;
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [props.steps, variant]);

  if (variant === "stream") {
    return (
      <Card className={cn("border-border/50 bg-card/35 backdrop-blur-xl", props.className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">AI stream</CardTitle>
            <span className="text-[11px] text-muted-foreground">{pct}%</span>
          </div>
          <progress
            value={pct}
            max={100}
            aria-label="Build progress"
            className={cn(
              "mt-2 h-1.5 w-full overflow-hidden rounded-full",
              "[&::-webkit-progress-bar]:bg-muted/50",
              "[&::-webkit-progress-value]:bg-gradient-to-r [&::-webkit-progress-value]:from-cyan-500 [&::-webkit-progress-value]:via-sky-500 [&::-webkit-progress-value]:to-emerald-400",
              "[&::-moz-progress-bar]:bg-gradient-to-r [&::-moz-progress-bar]:from-cyan-500 [&::-moz-progress-bar]:via-sky-500 [&::-moz-progress-bar]:to-emerald-400",
              "transition-all duration-500 ease-out",
              props.active && "shadow-[0_0_14px_rgba(34,211,238,0.55)]",
            )}
          />
        </CardHeader>
        <CardContent ref={feedRef} className="max-h-[min(70vh,900px)] space-y-1 overflow-y-auto pr-1 font-mono text-[11px]">
          {props.steps.map((s) => {
            const Icon =
              s.status === "complete" ? CheckCircle2 : s.status === "running" ? Loader2 : s.status === "failed" ? XCircle : Circle;
            const tone =
              s.status === "complete"
                ? "text-emerald-400"
                : s.status === "running"
                  ? "text-cyan-400"
                  : s.status === "failed"
                    ? "text-rose-400"
                    : "text-muted-foreground";
            const symbol = s.status === "complete" ? "✓" : s.status === "running" ? "→" : s.status === "failed" ? "×" : "·";
            return (
              <div key={s.key} className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/20">
                <Icon className={cn("mt-[1px] h-3.5 w-3.5 shrink-0", tone, s.status === "running" && "animate-spin")} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-[11px]", tone)}>{symbol}</span>
                    <span className="truncate text-foreground/90">{s.label}</span>
                    {s.status === "complete" ? <span className="text-emerald-300/80">complete</span> : null}
                    {s.status === "running" ? <span className="text-cyan-300/80">running</span> : null}
                  </div>
                  {s.message ? <div className={cn("truncate", tone)}>{s.message}</div> : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/50 bg-card/35 shadow-[0_0_32px_-14px_rgba(34,211,238,0.28)] backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Live build timeline</CardTitle>
        <CardDescription>Each phase streams in as the pipeline finishes work.</CardDescription>
        <div className="pt-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted/50">
            <progress
              value={pct}
              max={100}
              aria-label="Build progress"
              className={cn(
                "h-2 w-full overflow-hidden rounded-full",
                "[&::-webkit-progress-bar]:bg-muted/50",
                "[&::-webkit-progress-value]:bg-gradient-to-r [&::-webkit-progress-value]:from-cyan-500 [&::-webkit-progress-value]:via-sky-500 [&::-webkit-progress-value]:to-emerald-400",
                "[&::-moz-progress-bar]:bg-gradient-to-r [&::-moz-progress-bar]:from-cyan-500 [&::-moz-progress-bar]:via-sky-500 [&::-moz-progress-bar]:to-emerald-400",
                "transition-all duration-500 ease-out",
                props.active && "shadow-[0_0_16px_rgba(34,211,238,0.55)]",
              )}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-[min(70vh,820px)] space-y-2 overflow-y-auto pr-1">
        {props.steps.map((s) => {
          const Icon =
            s.status === "complete" ? CheckCircle2 : s.status === "running" ? Loader2 : s.status === "failed" ? XCircle : Circle;
          const tone =
            s.status === "complete"
              ? "text-emerald-400"
              : s.status === "running"
                ? "text-cyan-400"
                : s.status === "failed"
                  ? "text-rose-400"
                  : "text-muted-foreground";
          return (
            <div
              key={s.key}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm transition-colors",
                s.status === "running" && "border-cyan-500/45 bg-cyan-500/10 shadow-[0_0_20px_-8px_rgba(34,211,238,0.45)]",
                s.status === "complete" && "border-emerald-500/30 bg-emerald-500/5",
                s.status === "pending" && "border-border/50 bg-background/30",
                s.status === "failed" && "border-rose-500/35 bg-rose-500/10",
              )}
            >
              <div className="flex items-start gap-2">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone, s.status === "running" && "animate-spin")} />
                <div className="min-w-0">
                  <div className="font-medium leading-tight">{s.label}</div>
                  <div className={cn("mt-0.5 text-[11px]", tone)}>{s.message ?? s.status}</div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
