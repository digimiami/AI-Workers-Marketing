"use client";

import { Clapperboard } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceActionBar } from "@/components/workspace/WorkspaceActionBar";
import type { LiveContentItem } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function ContentResultCard(props: {
  items: LiveContentItem[] | null | undefined;
  campaignId: string | null;
  draft?: boolean;
  onRegenerate?: () => void | Promise<void>;
  className?: string;
}) {
  const items = props.items ?? [];
  if (!items.length) return null;
  const cid = props.campaignId;
  return (
    <Card className={cn("border-border/50 bg-card/40 shadow-[0_0_28px_-12px_rgba(34,211,238,0.2)] backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-fuchsia-400" />
          <CardTitle className="text-base">Hooks & scripts</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1 text-xs">
          {items.slice(0, 8).map((it) => (
            <li key={it.id} className="rounded-lg border border-border/50 bg-muted/10 p-2">
              <div className="font-medium text-foreground/90">{it.hook || it.script || "Asset"}</div>
              {it.script && it.hook ? <p className="mt-1 text-muted-foreground line-clamp-3">{it.script}</p> : null}
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span>{it.platform}</span>
                {it.cta ? <span className="text-cyan-300/90">CTA: {it.cta}</span> : null}
              </div>
            </li>
          ))}
        </ul>
        <WorkspaceActionBar
          showDraftBadge={props.draft}
          openHref={cid ? `/admin/campaigns/${cid}?tab=content` : undefined}
          editHref={cid ? `/admin/campaigns/${cid}?tab=content` : undefined}
          onRegenerate={props.onRegenerate}
        />
      </CardContent>
    </Card>
  );
}
