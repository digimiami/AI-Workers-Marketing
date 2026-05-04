"use client";

import * as React from "react";

import { CheckCircle2, ChevronDown, Circle, Loader2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function BuildStepCard(props: {
  label: string;
  status: "pending" | "running" | "complete" | "failed";
  message?: string;
  /** When set, step expands to show live result preview */
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon =
    props.status === "complete"
      ? CheckCircle2
      : props.status === "running"
        ? Loader2
        : props.status === "failed"
          ? XCircle
          : Circle;
  const tone =
    props.status === "complete"
      ? "text-emerald-500"
      : props.status === "running"
        ? "text-sky-500"
        : props.status === "failed"
          ? "text-rose-500"
          : "text-muted-foreground";

  if (!props.children) {
    return (
      <div className={cn("rounded-xl border border-border/60 bg-background/40 p-3 shadow-sm", props.className)}>
        <div className="flex items-start gap-2">
          <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", tone, props.status === "running" && "animate-spin")} />
          <div className="min-w-0">
            <div className="text-sm font-medium">{props.label}</div>
            <div className={cn("mt-1 text-xs", tone)}>{props.message ?? props.status}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <details
      className={cn(
        "group rounded-xl border border-border/60 bg-background/40 shadow-sm open:border-primary/25 open:shadow-[0_0_20px_-8px_rgba(56,189,248,0.2)]",
        props.className,
      )}
      open={props.status === "running" || props.status === "complete"}
    >
      <summary className="flex cursor-pointer list-none items-start gap-2 p-3 [&::-webkit-details-marker]:hidden">
        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", tone, props.status === "running" && "animate-spin")} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">{props.label}</div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </div>
          <div className={cn("mt-1 text-xs", tone)}>{props.message ?? props.status}</div>
        </div>
      </summary>
      <div className="border-t border-border/50 bg-muted/10 px-3 pb-3 pt-2">{props.children}</div>
    </details>
  );
}

export default BuildStepCard;
