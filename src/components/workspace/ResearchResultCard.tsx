"use client";

import { Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceActionBar } from "@/components/workspace/WorkspaceActionBar";
import type { LiveResearch } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function ResearchResultCard(props: {
  data: LiveResearch | null | undefined;
  runId: string | null;
  campaignId: string | null;
  onRegenerate?: () => void | Promise<void>;
  className?: string;
}) {
  const d = props.data;
  if (!d) return null;
  return (
    <Card className={cn("border-border/50 bg-card/40 shadow-[0_0_28px_-12px_rgba(34,211,238,0.25)] backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-cyan-400" />
          <CardTitle className="text-base">Research</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        {d.offerSummary ? <p className="text-sm leading-relaxed text-foreground/90">{d.offerSummary}</p> : null}
        {d.audience ? (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Audience</div>
            <p>{d.audience}</p>
          </div>
        ) : null}
        {d.painPoints?.length ? (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pain points</div>
            <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
              {d.painPoints.slice(0, 6).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {d.hooks?.length ? (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hooks</div>
            <ul className="mt-1 space-y-1 text-xs">
              {d.hooks.slice(0, 8).map((h) => (
                <li key={h} className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1">
                  {h}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <WorkspaceActionBar showDraftBadge={d.origin === "live_preview"} onRegenerate={props.runId ? props.onRegenerate : undefined} />
      </CardContent>
    </Card>
  );
}
