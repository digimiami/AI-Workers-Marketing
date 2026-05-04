"use client";

import * as React from "react";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function BuildStepCard(props: {
  label: string;
  status: "pending" | "running" | "complete" | "failed";
  message?: string;
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

  return (
    <div className={cn("rounded-xl border border-border/60 bg-background/40 p-3", props.className)}>
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

export default BuildStepCard;

