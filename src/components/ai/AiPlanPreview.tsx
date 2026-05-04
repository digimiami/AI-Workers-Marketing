"use client";

import * as React from "react";

import { Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asRows<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function AiPlanPreview(props: {
  /** If you pass `plan`, it will render a basic preview automatically. */
  plan?: unknown;
  onRun?: () => void | Promise<void>;
  runLabel?: string;
  title?: string;
  description?: string;
  meta?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const planObj = asRecord(props.plan);
  const stages = asRows<Record<string, unknown>>(planObj.stages);

  return (
    <Card className={cn("border-border/60 bg-card/40 backdrop-blur-sm", props.className)}>
      <CardHeader>
        <CardTitle className="text-base">{props.title ?? "AI plan"}</CardTitle>
        <CardDescription>{props.description ?? "Preview what AI will build and what needs approval."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.meta ? <div>{props.meta}</div> : null}
        {props.children ? (
          props.children
        ) : props.plan ? (
          <>
            {stages.length ? (
              <div className="grid gap-3 md:grid-cols-4">
                {stages.map((stage, i) => (
                  <div key={String(stage.id ?? stage.name ?? i)} className="rounded-xl border border-border/60 bg-background/40 p-3">
                    <div className="text-sm font-semibold">{s(stage.name) || `Stage ${i + 1}`}</div>
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-4">
                      {s(stage.description) || s(stage.summary) || "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="max-h-[420px] overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                {JSON.stringify(props.plan, null, 2)}
              </pre>
            )}
            {props.onRun ? (
              <Button type="button" onClick={() => void props.onRun?.()}>
                <Rocket className="h-4 w-4 mr-2" />
                {props.runLabel ?? "Build Workspace"}
              </Button>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default AiPlanPreview;

