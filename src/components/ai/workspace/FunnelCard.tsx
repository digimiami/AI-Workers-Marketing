"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type FunnelCardData = {
  name?: string;
  flowDiagram?: string;
  flow?: string[];
  steps?: Array<{ name?: string; stepType?: string }>;
};

const DEFAULT_VISUAL = ["Landing", "Bridge", "Capture", "CTA", "Thank You"];

export function FunnelCard(props: { data?: unknown; campaignId: string | null; className?: string }) {
  const d = (props.data && typeof props.data === "object" ? props.data : {}) as FunnelCardData;
  const flow = Array.isArray(d.flow) && d.flow.length ? d.flow : [];
  if (!flow.length && !d.flowDiagram && !d.steps?.length) return null;
  const labels = flow.length ? flow : d.flowDiagram ? d.flowDiagram.split(/\s*→\s*/).map((s) => s.trim()) : [...DEFAULT_VISUAL];
  const dbSteps = Array.isArray(d.steps) ? d.steps : [];
  return (
    <Card className={cn("border-border/60 bg-card/50 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-sky-400" />
          <CardTitle className="text-base">{d.name || "Funnel"}</CardTitle>
        </div>
        <CardDescription className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-1 text-[11px] sm:text-xs">
            {(labels.length ? labels : DEFAULT_VISUAL).map((label, i) => (
              <span key={`${label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <span className="text-muted-foreground px-0.5">→</span> : null}
                <span className="rounded-full border border-sky-500/35 bg-sky-500/10 px-2 py-1 font-medium text-foreground/90 shadow-[0_0_12px_-4px_rgba(56,189,248,0.45)]">
                  {label}
                </span>
              </span>
            ))}
          </div>
          {dbSteps.length ? (
            <div className="rounded-lg border border-border/50 bg-muted/15 p-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Provisioned steps</div>
              <div className="flex flex-wrap gap-1.5">
                {dbSteps.map((s, idx) => (
                  <span
                    key={`${s.name}-${idx}`}
                    className="rounded-md border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-foreground/90"
                  >
                    {s.name || s.stepType || `Step ${idx + 1}`}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </CardDescription>
      </CardHeader>
      {props.campaignId ? (
        <CardContent className="pt-0">
          <Link href={`/f/${props.campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open funnel
          </Link>
        </CardContent>
      ) : null}
    </Card>
  );
}
