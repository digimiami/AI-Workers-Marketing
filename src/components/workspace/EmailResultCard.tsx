"use client";

import { Mail } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceActionBar } from "@/components/workspace/WorkspaceActionBar";
import type { LiveEmailStep } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function EmailResultCard(props: {
  steps: LiveEmailStep[] | null | undefined;
  campaignId: string | null;
  draft?: boolean;
  onRegenerate?: () => void | Promise<void>;
  className?: string;
}) {
  const steps = props.steps ?? [];
  if (!steps.length) return null;
  const cid = props.campaignId;
  return (
    <Card className={cn("border-border/50 bg-card/40 shadow-[0_0_28px_-12px_rgba(34,211,238,0.2)] backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-emerald-400" />
          <CardTitle className="text-base">Email sequence</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-xs">
        <ol className="space-y-2">
          {steps.map((s) => (
            <li key={s.id} className="rounded-lg border border-border/50 bg-muted/10 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Step {s.step + 1}</span>
                <span className="text-[10px] text-muted-foreground">{s.delay}</span>
              </div>
              <div className="mt-1 font-medium text-foreground/90">{s.subject}</div>
              <p className="mt-1 text-muted-foreground line-clamp-3">{s.preview}</p>
            </li>
          ))}
        </ol>
        <WorkspaceActionBar
          showDraftBadge={props.draft}
          openHref={cid ? `/admin/campaigns/${cid}?tab=emails` : undefined}
          editHref={cid ? `/admin/email` : undefined}
          onRegenerate={props.onRegenerate}
        />
      </CardContent>
    </Card>
  );
}
