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

export function FunnelCard(props: { data?: unknown; campaignId: string | null; className?: string }) {
  const d = (props.data && typeof props.data === "object" ? props.data : {}) as FunnelCardData;
  const flow = Array.isArray(d.flow) && d.flow.length ? d.flow : [];
  if (!flow.length && !d.flowDiagram && !d.steps?.length) return null;
  const labels = flow.length ? flow : d.flowDiagram ? d.flowDiagram.split(/\s*→\s*/).map((s) => s.trim()) : [];
  return (
    <Card className={cn("border-border/60 bg-card/50 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-sky-400" />
          <CardTitle className="text-base">{d.name || "Funnel"}</CardTitle>
        </div>
        <CardDescription className="pt-2">
          <div className="flex flex-wrap items-center gap-1 text-[11px] sm:text-xs">
            {(labels.length ? labels : ["Landing", "Lead", "Bridge", "CTA", "Thank You"]).map((label, i, arr) => (
              <span key={`${label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <span className="text-muted-foreground px-0.5">→</span> : null}
                <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-1 font-medium text-foreground/90">
                  {label}
                </span>
                {i === arr.length - 1 ? null : null}
              </span>
            ))}
          </div>
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
