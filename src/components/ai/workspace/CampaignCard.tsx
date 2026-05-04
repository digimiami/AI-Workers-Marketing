"use client";

import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type CampaignCardData = {
  id?: string | null;
  name?: string;
  goal?: string;
  audience?: string;
  trafficSource?: string;
};

export function CampaignCard(props: {
  data?: unknown;
  campaignId: string | null;
  className?: string;
}) {
  const d = (props.data && typeof props.data === "object" ? props.data : {}) as CampaignCardData;
  const id = props.campaignId ?? (typeof d.id === "string" ? d.id : null);
  if (!id && !d.name && !d.goal) return null;
  const name = d.name || "Campaign";
  return (
    <Card
      className={cn(
        "border-border/60 bg-gradient-to-br from-card/90 to-card/40 shadow-[0_0_24px_-8px_rgba(56,189,248,0.25)] transition-shadow hover:shadow-[0_0_32px_-6px_rgba(56,189,248,0.35)]",
        props.className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{name}</CardTitle>
        <CardDescription className="space-y-1 text-xs">
          {d.goal ? <div className="text-foreground/90">{d.goal}</div> : null}
          {d.audience ? <div className="text-muted-foreground">Audience: {d.audience}</div> : null}
          {d.trafficSource ? <div className="text-muted-foreground">Traffic: {d.trafficSource}</div> : null}
        </CardDescription>
      </CardHeader>
      {id ? (
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <Link href={`/admin/campaigns/${id}`} className={buttonVariants({ size: "sm" })}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Open
          </Link>
          <Link
            href={`/admin/campaigns/${id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </CardContent>
      ) : null}
    </Card>
  );
}
