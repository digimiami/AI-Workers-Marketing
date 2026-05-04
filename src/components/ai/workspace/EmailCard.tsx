"use client";

import Link from "next/link";
import { Mail } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type EmailCardData = {
  sequenceName?: string;
  steps?: Array<{ stepIndex?: number; subject?: string; delayMinutes?: number; templateName?: string }>;
};

export function EmailCard(props: { data?: unknown; campaignId: string | null; className?: string }) {
  const d = (props.data && typeof props.data === "object" ? props.data : {}) as EmailCardData;
  const steps = Array.isArray(d.steps) ? d.steps : [];
  if (!steps.length) return null;
  return (
    <Card className={cn("border-border/60 bg-card/50 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-violet-400" />
          <CardTitle className="text-base">{d.sequenceName || "Email sequence"}</CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">{steps.length} steps</CardDescription>
      </CardHeader>
      <CardContent className="max-h-48 space-y-2 overflow-y-auto pt-0 text-sm">
        {steps.map((s, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Step {s.stepIndex ?? i + 1}</div>
            <div className="font-medium leading-snug">{s.subject || "Subject TBD"}</div>
            {s.delayMinutes != null ? (
              <div className="text-[11px] text-muted-foreground">Delay: {s.delayMinutes} min</div>
            ) : null}
          </div>
        ))}
        {props.campaignId ? (
          <Link href={`/admin/campaigns/${props.campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open emails
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
