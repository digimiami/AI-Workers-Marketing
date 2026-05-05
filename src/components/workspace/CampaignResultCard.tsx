"use client";

import { Target } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceActionBar } from "@/components/workspace/WorkspaceActionBar";
import type { LiveCampaign } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function CampaignResultCard(props: {
  data: LiveCampaign | null | undefined;
  campaignId: string | null;
  onRegenerate?: () => void | Promise<void>;
  className?: string;
}) {
  const d = props.data;
  if (!d) return null;
  const cid = props.campaignId ?? d.id;
  return (
    <Card className={cn("border-border/50 bg-card/40 shadow-[0_0_28px_-12px_rgba(34,211,238,0.2)] backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-sky-400" />
          <CardTitle className="text-base">{d.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Goal</div>
            <p className="text-xs">{d.goal}</p>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Audience</div>
            <p className="text-xs">{d.audience}</p>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Strategy</div>
          <p className="text-xs leading-relaxed text-muted-foreground">{d.strategy}</p>
        </div>
        <WorkspaceActionBar
          showDraftBadge={d.origin === "live_preview"}
          openHref={cid ? `/admin/campaigns/${cid}` : undefined}
          editHref={cid ? `/admin/campaigns/${cid}` : undefined}
          onRegenerate={props.onRegenerate}
        />
      </CardContent>
    </Card>
  );
}
