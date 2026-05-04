"use client";

import { Activity } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AnalyticsCardData = {
  trackingReady?: boolean;
  eventsInitialized?: boolean;
  status?: string;
  links?: Array<{ id: string; label: string | null; destination_url: string }>;
};

export function AnalyticsCard(props: { data?: unknown; className?: string }) {
  const d = (props.data && typeof props.data === "object" ? props.data : {}) as AnalyticsCardData;
  const hasLinks = Array.isArray(d.links) && d.links.length > 0;
  const pendingOnly = d.status === "pending" && !hasLinks && !d.trackingReady;
  return (
    <Card className={cn("border-border/60 bg-card/50 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <CardTitle className="text-base">Analytics</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        {pendingOnly ? (
          <p className="text-xs text-muted-foreground">Analytics activates during the execution phase when tracking links are provisioned.</p>
        ) : null}
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5",
              d.trackingReady ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-border/60 text-muted-foreground",
            )}
          >
            Tracking {d.trackingReady ? "ready" : "pending"}
          </span>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5",
              d.eventsInitialized ? "border-sky-500/40 bg-sky-500/10 text-sky-200" : "border-border/60 text-muted-foreground",
            )}
          >
            Events {d.eventsInitialized ? "initialized" : "pending"}
          </span>
        </div>
        {hasLinks ? (
          <ul className="text-xs text-muted-foreground">
            {d.links!.slice(0, 3).map((l) => (
              <li key={l.id} className="truncate">
                {l.label || "Link"} → {l.destination_url.slice(0, 64)}
                {l.destination_url.length > 64 ? "…" : ""}
              </li>
            ))}
          </ul>
        ) : d.status === "initializing" ? (
          <p className="text-xs text-muted-foreground">Provisioning tracking…</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
