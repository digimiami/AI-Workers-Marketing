"use client";

import { Shield } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkspaceActionBar } from "@/components/workspace/WorkspaceActionBar";
import type { LiveApproval } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function ApprovalsResultCard(props: {
  items: LiveApproval[] | null | undefined;
  organizationId: string;
  className?: string;
}) {
  const items = props.items ?? [];
  if (!items.length) return null;

  const decide = async (id: string, decision: "approved" | "rejected") => {
    const res = await fetch(`/api/admin/openclaw/approvals/${id}/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: props.organizationId, decision }),
    });
    if (!res.ok) {
      toast.error("Could not update approval");
      return;
    }
    toast.success(decision === "approved" ? "Approved" : "Rejected");
  };

  return (
    <Card className={cn("border-border/50 bg-card/40 shadow-[0_0_28px_-12px_rgba(251,191,36,0.2)] backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-400" />
          <CardTitle className="text-base">Approvals</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-xs">
        <ul className="max-h-[280px] space-y-2 overflow-y-auto">
          {items.slice(0, 12).map((a) => (
            <li key={a.id} className="rounded-lg border border-border/50 bg-muted/10 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{a.type}</span>
                <span className="text-[10px] text-muted-foreground">{a.status}</span>
              </div>
              {a.target ? <div className="text-[10px] text-muted-foreground">Target: {a.target}</div> : null}
              {a.risk ? <p className="mt-1 line-clamp-2 text-amber-200/80">{a.risk}</p> : null}
              {a.status === "pending" ? (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" className="h-7 text-xs" variant="secondary" onClick={() => decide(a.id, "approved")}>
                    Approve
                  </Button>
                  <Button size="sm" className="h-7 text-xs" variant="outline" onClick={() => decide(a.id, "rejected")}>
                    Reject
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <WorkspaceActionBar openHref="/admin/approvals" />
      </CardContent>
    </Card>
  );
}
