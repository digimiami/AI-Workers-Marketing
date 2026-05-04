"use client";

import { Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ResearchCardData = {
  audience?: string;
  painPoints?: string[];
  hooks?: string[];
  offerSummary?: string;
};

export function ResearchCard(props: { data?: unknown; className?: string }) {
  const d = (props.data && typeof props.data === "object" ? props.data : {}) as ResearchCardData;
  const hooks = Array.isArray(d.hooks) ? d.hooks.filter((x): x is string => typeof x === "string") : [];
  const pains = Array.isArray(d.painPoints) ? d.painPoints.filter((x): x is string => typeof x === "string") : [];
  if (!d.audience && !hooks.length && !pains.length && !d.offerSummary) return null;
  return (
    <Card className={cn("border-border/60 bg-card/50 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-cyan-400" />
          <CardTitle className="text-base">Research</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        {d.offerSummary ? <p className="text-xs text-foreground/90">{d.offerSummary}</p> : null}
        {d.audience ? (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Audience</div>
            <p className="text-sm">{d.audience}</p>
          </div>
        ) : null}
        {pains.length ? (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pain points</div>
            <p className="text-xs text-muted-foreground">{pains.slice(0, 4).join(" · ")}</p>
          </div>
        ) : null}
        {hooks.length ? (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Hooks</div>
            <ul className="list-disc space-y-0.5 pl-4 text-xs">
              {hooks.slice(0, 5).map((h) => (
                <li key={h.slice(0, 32)}>{h}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
