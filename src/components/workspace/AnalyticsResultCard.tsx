"use client";

import { Activity } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceActionBar } from "@/components/workspace/WorkspaceActionBar";
import type { LiveAnalytics } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function AnalyticsResultCard(props: {
  data: LiveAnalytics | null | undefined;
  campaignId: string | null;
  onRegenerate?: () => void | Promise<void>;
  className?: string;
}) {
  const d = props.data;
  if (!d) return null;
  return (
    <Card className={cn("border-border/50 bg-card/40 shadow-[0_0_28px_-12px_rgba(52,211,153,0.2)] backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <CardTitle className="text-base">Analytics & tracking</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5",
              d.status === "ready" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-border/60 text-muted-foreground",
            )}
          >
            {d.status}
          </span>
        </div>
        {d.trackingLink ? (
          <a href={d.trackingLink} className="break-all text-[11px] text-sky-400 hover:underline" target="_blank" rel="noreferrer">
            {d.trackingLink}
          </a>
        ) : null}
        {d.events?.length ? (
          <div className="text-xs text-muted-foreground">Events: {d.events.join(", ")}</div>
        ) : null}
        <WorkspaceActionBar showDraftBadge={d.origin === "live_preview"} openHref="/admin/analytics" onRegenerate={props.onRegenerate} />
      </CardContent>
    </Card>
  );
}
