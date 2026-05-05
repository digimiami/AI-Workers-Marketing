"use client";

import { GitBranch } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceActionBar } from "@/components/workspace/WorkspaceActionBar";
import type { LiveFunnel } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function FunnelResultCard(props: {
  data: LiveFunnel | null | undefined;
  campaignId: string | null;
  onRegenerate?: () => void | Promise<void>;
  className?: string;
}) {
  const d = props.data;
  if (!d) return null;
  const cid = props.campaignId;
  const labels = d.flowDiagram ? d.flowDiagram.split(/\s*→\s*/).map((s) => s.trim()).filter(Boolean) : d.steps.map((s) => s.name);
  return (
    <Card className={cn("border-border/50 bg-card/40 shadow-[0_0_28px_-12px_rgba(34,211,238,0.2)] backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-sky-400" />
          <CardTitle className="text-base">{d.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        <div className="flex flex-wrap items-center gap-1 text-[11px] sm:text-xs">
          {(labels.length ? labels : ["Landing", "Bridge", "Lead", "CTA", "Thanks", "Email"]).map((label, i) => (
            <span key={`${label}-${i}`} className="flex items-center gap-1">
              {i > 0 ? <span className="text-muted-foreground">→</span> : null}
              <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 font-medium text-foreground/90 shadow-[0_0_12px_-4px_rgba(34,211,238,0.35)]">
                {label}
              </span>
            </span>
          ))}
        </div>
        {d.steps.length ? (
          <div className="rounded-lg border border-border/50 bg-muted/10 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Steps</div>
            <ul className="space-y-1 text-xs">
              {d.steps.map((s, i) => (
                <li key={`${s.name}-${i}`} className="flex justify-between gap-2">
                  <span>{s.name}</span>
                  <span className="text-muted-foreground">{s.type}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <WorkspaceActionBar
          showDraftBadge={d.origin === "live_preview"}
          openHref={cid ? `/admin/campaigns/${cid}?tab=funnel` : undefined}
          editHref={cid ? `/admin/campaigns/${cid}?tab=funnel` : undefined}
          onRegenerate={props.onRegenerate}
        />
      </CardContent>
    </Card>
  );
}
