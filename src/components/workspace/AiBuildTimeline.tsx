"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiveBuildStepKey, LiveBuildStepStatus } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function AiBuildTimeline(props: {
  steps: Array<{ key: LiveBuildStepKey; label: string; status: LiveBuildStepStatus; message?: string }>;
  active: boolean;
  progress: number;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, props.progress)) * 100);
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
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-400 transition-[width] duration-500 ease-out",
                props.active && "shadow-[0_0_16px_rgba(34,211,238,0.55)]",
              )}
              style={{ width: `${pct}%` }}
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
