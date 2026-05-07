"use client";

import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type LandingCardData = {
  id?: string | null;
  headline?: string;
  subheadline?: string;
  cta?: string;
  title?: string;
};

export function LandingCard(props: { data?: unknown; campaignId: string | null; className?: string }) {
  const d = (props.data && typeof props.data === "object" ? props.data : {}) as LandingCardData;
  // STRICT: render nothing unless AI produced a real headline. No "Landing" / template defaults.
  const headline = (d.headline || d.title || "").trim();
  if (!headline) return null;
  return (
    <Card
      className={cn(
        "border-border/60 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/30",
        props.className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Landing</CardTitle>
        <CardDescription className="space-y-1 text-sm text-foreground/90">
          <div className="font-medium leading-snug">{headline}</div>
          {d.subheadline ? <div className="text-xs text-muted-foreground">{d.subheadline}</div> : null}
          {d.cta ? (
            <div className="text-xs">
              <span className="text-muted-foreground">CTA:</span> {d.cta}
            </div>
          ) : null}
        </CardDescription>
      </CardHeader>
      {props.campaignId ? (
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <Link
            href={`/f/${props.campaignId}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
          >
            Preview
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link href={`/admin/campaigns/${props.campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Link>
        </CardContent>
      ) : null}
    </Card>
  );
}
