"use client";

import { LayoutTemplate } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceActionBar } from "@/components/workspace/WorkspaceActionBar";
import type { LiveLanding } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function LandingResultCard(props: {
  data: LiveLanding | null | undefined;
  campaignId: string | null;
  onRegenerate?: () => void | Promise<void>;
  className?: string;
}) {
  const d = props.data;
  if (!d) return null;
  const cid = props.campaignId;
  return (
    <Card className={cn("border-border/50 bg-card/40 shadow-[0_0_28px_-12px_rgba(34,211,238,0.2)] backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-violet-400" />
          <CardTitle className="text-base">Landing page</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        <div className="text-lg font-semibold tracking-tight text-foreground">{d.headline}</div>
        {d.subheadline ? <p className="text-xs text-muted-foreground">{d.subheadline}</p> : null}
        {d.bullets?.length ? (
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {d.bullets.slice(0, 6).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        <div className="text-xs">
          <span className="text-muted-foreground">CTA:</span> <span className="font-medium text-cyan-200">{d.ctaText}</span>
        </div>
        <WorkspaceActionBar
          showDraftBadge={d.origin === "live_preview"}
          openHref={cid ? `/admin/campaigns/${cid}` : undefined}
          editHref={cid ? `/admin/campaigns/${cid}` : undefined}
          previewHref={d.previewUrl}
          onRegenerate={props.onRegenerate}
        />
      </CardContent>
    </Card>
  );
}
