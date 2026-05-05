"use client";

import { Megaphone } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceActionBar } from "@/components/workspace/WorkspaceActionBar";
import type { LiveAd } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function AdsResultCard(props: {
  items: LiveAd[] | null | undefined;
  campaignId: string | null;
  draft?: boolean;
  onRegenerate?: () => void | Promise<void>;
  className?: string;
}) {
  const items = props.items ?? [];
  if (!items.length) return null;
  const cid = props.campaignId;
  return (
    <Card className={cn("border-border/50 bg-card/40 shadow-[0_0_28px_-12px_rgba(251,146,60,0.2)] backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-orange-400" />
          <CardTitle className="text-base">Ads</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-xs">
        <ul className="space-y-2">
          {items.slice(0, 6).map((ad) => (
            <li key={ad.id} className="rounded-lg border border-border/50 bg-muted/10 p-2">
              <div className="font-medium">{ad.headline}</div>
              <p className="mt-1 text-muted-foreground line-clamp-2">{ad.primaryText}</p>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span>{ad.platform}</span>
                {ad.angle ? <span>Angle: {ad.angle}</span> : null}
                <span className="text-orange-200/90">CTA: {ad.cta}</span>
              </div>
            </li>
          ))}
        </ul>
        <WorkspaceActionBar
          showDraftBadge={props.draft}
          openHref={cid ? `/admin/ad-creative` : undefined}
          editHref={cid ? `/admin/campaigns/${cid}` : undefined}
          onRegenerate={props.onRegenerate}
        />
      </CardContent>
    </Card>
  );
}
