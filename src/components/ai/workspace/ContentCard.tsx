"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ContentCardData = {
  totalCount?: number;
  hooksPreview?: string[];
  hooksCount?: number;
  firstTitle?: string;
  scriptsPreview?: string[];
};

export function ContentCard(props: { data?: unknown; campaignId: string | null; className?: string }) {
  const d = (props.data && typeof props.data === "object" ? props.data : {}) as ContentCardData;
  const hooks = Array.isArray(d.hooksPreview) ? d.hooksPreview.filter((x): x is string => typeof x === "string") : [];
  const scripts = Array.isArray(d.scriptsPreview) ? d.scriptsPreview.filter((x): x is string => typeof x === "string") : [];
  const total = typeof d.totalCount === "number" ? d.totalCount : hooks.length;
  if (!total && !hooks.length && !scripts.length) return null;
  return (
    <Card className={cn("border-border/60 bg-card/50 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <CardTitle className="text-base">Content</CardTitle>
        </div>
        {d.firstTitle ? <p className="text-xs text-muted-foreground">{d.firstTitle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {hooks.length ? (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hooks</div>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {hooks.slice(0, 8).map((h) => (
                <li key={h.slice(0, 48)} className="text-foreground/90">
                  {h}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {scripts.length ? (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Script preview</div>
            <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/50 bg-muted/20 p-2 font-mono text-[11px] leading-relaxed text-foreground/85">
              {scripts[0]}
            </pre>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {typeof d.hooksCount === "number" ? `${d.hooksCount} hooks · ` : ""}
          {total} assets
        </p>
        {props.campaignId ? (
          <Link href={`/admin/campaigns/${props.campaignId}?tab=content`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            View all
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
