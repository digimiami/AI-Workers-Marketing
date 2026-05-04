"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AdsCardData = {
  count?: number;
  items?: Array<{ id?: string; headline?: string; primaryText?: string; platform?: string }>;
};

export function AdsCard(props: { data?: unknown; campaignId: string | null; className?: string }) {
  const d = (props.data && typeof props.data === "object" ? props.data : {}) as AdsCardData;
  const items = Array.isArray(d.items) ? d.items : [];
  const count = typeof d.count === "number" ? d.count : items.length;
  if (!count && !items.length) return null;
  return (
    <Card className={cn("border-border/60 bg-card/50 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-orange-400" />
          <CardTitle className="text-base">Ads</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        <p className="text-xs text-muted-foreground">{count} creatives</p>
        <ul className="space-y-1">
          {items.slice(0, 4).map((it, i) => (
            <li key={it.id ?? i} className="rounded-md border border-border/40 bg-muted/15 px-2 py-1 text-xs">
              <span className="font-medium">{it.headline || "Creative"}</span>
              {it.platform ? <span className="ml-2 text-muted-foreground">· {it.platform}</span> : null}
            </li>
          ))}
        </ul>
        {props.campaignId ? (
          <Link href={`/admin/campaigns/${props.campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Edit ads
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
