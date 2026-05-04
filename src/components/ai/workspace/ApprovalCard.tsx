"use client";

import Link from "next/link";
import { Shield } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ApprovalCardData = {
  pendingCount?: number;
  items?: Array<{ id?: string; approval_type?: string; status?: string; action?: string }>;
};

export function ApprovalCard(props: { data?: unknown; campaignId: string | null; className?: string }) {
  const d = (props.data && typeof props.data === "object" ? props.data : {}) as ApprovalCardData;
  const items = Array.isArray(d.items) ? d.items : [];
  if (!items.length) return null;
  const pending = typeof d.pendingCount === "number" ? d.pendingCount : items.filter((x) => x.status === "pending").length;
  return (
    <Card className={cn("border-border/60 bg-card/50 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-400" />
          <CardTitle className="text-base">Approvals</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="text-sm text-muted-foreground">
          {pending} pending · {items.length} total
        </p>
        <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
          {items.slice(0, 8).map((a) => (
            <li key={a.id} className="flex justify-between gap-2 rounded border border-border/40 bg-muted/15 px-2 py-1">
              <span className="truncate font-medium">{a.action || a.approval_type || "Approval"}</span>
              <span className="shrink-0 text-muted-foreground">{a.status}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/approvals" className={buttonVariants({ size: "sm" })}>
            Approve
          </Link>
          {props.campaignId ? (
            <Link href={`/admin/workspace/review/${props.campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Review
            </Link>
          ) : (
            <Link href="/admin/approvals" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Review
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
