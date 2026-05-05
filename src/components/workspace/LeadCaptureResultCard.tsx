"use client";

import { FormInput } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceActionBar } from "@/components/workspace/WorkspaceActionBar";
import type { LiveLeadCapture } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function LeadCaptureResultCard(props: {
  data: LiveLeadCapture | null | undefined;
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
          <FormInput className="h-4 w-4 text-slate-300" />
          <CardTitle className="text-base">Lead capture</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        <div className="text-sm font-medium">{d.formName}</div>
        {d.fields?.length ? (
          <div className="text-xs text-muted-foreground">Fields: {d.fields.join(", ")}</div>
        ) : null}
        <div className="text-xs">
          CTA: <span className="text-cyan-200">{d.cta}</span>
        </div>
        {d.publicUrl ? (
          <a href={d.publicUrl} className="break-all text-[11px] text-sky-400 hover:underline" target="_blank" rel="noreferrer">
            {d.publicUrl}
          </a>
        ) : null}
        <WorkspaceActionBar showDraftBadge={d.origin === "live_preview"} openHref={cid ? `/admin/leads` : undefined} onRegenerate={props.onRegenerate} />
      </CardContent>
    </Card>
  );
}
