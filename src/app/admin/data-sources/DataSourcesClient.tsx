"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type Status = "connected" | "pending" | "disconnected" | "stubbed";
type Row = { key: string; label: string; status: Status; details?: Record<string, unknown> };

const statusMeta: Record<Status, { label: string; badge: "default" | "secondary" | "outline" | "destructive" }> = {
  connected: { label: "Connected", badge: "default" },
  pending: { label: "Pending", badge: "secondary" },
  disconnected: { label: "Disconnected", badge: "outline" },
  stubbed: { label: "Stubbed", badge: "outline" },
};

export function DataSourcesClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const sourcesQuery = useQuery({
    queryKey: ["data-sources", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/data-sources?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; sources: Row[] };
      return j.sources ?? [];
    },
  });

  const [draft, setDraft] = React.useState<Row[]>([]);
  React.useEffect(() => {
    if (sourcesQuery.data) setDraft(sourcesQuery.data);
  }, [sourcesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = z
        .object({
          organizationId: z.string().uuid(),
          sources: z
            .array(z.object({ key: z.string(), label: z.string(), status: z.enum(["connected", "pending", "disconnected", "stubbed"]) }))
            .min(1),
        })
        .parse({ organizationId, sources: draft });

      const res = await fetch("/api/admin/data-sources", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Data sources updated");
      await qc.invalidateQueries({ queryKey: ["data-sources", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update data sources"),
  });

  const connected = draft.filter((d) => d.status === "connected").length;
  const pending = draft.filter((d) => d.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data Sources</h1>
        <p className="text-sm text-muted-foreground">
          Connect the inputs that feed your Single Brain: websites, lead systems, analytics, documents, and channel signals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tracking-tight">{sourcesQuery.isLoading ? "…" : connected}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tracking-tight">{sourcesQuery.isLoading ? "…" : pending}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">System note</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Some providers remain <span className="font-medium text-foreground">stubbed</span> until credentials are configured.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sources</CardTitle>
          <p className="text-xs text-muted-foreground">
            Status indicates whether workers can reliably read/write from the source.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {sourcesQuery.isError ? <p className="text-sm text-destructive">Failed to load sources.</p> : null}
          <div className="space-y-3">
            {draft.map((s, idx) => (
              <div key={s.key} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{s.label}</p>
                    <Badge variant={statusMeta[s.status].badge}>{statusMeta[s.status].label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Key: <span className="font-mono">{s.key}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={s.status}
                    onValueChange={(v) => {
                      setDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, status: v as Status } : r)));
                    }}
                  >
                    <SelectTrigger className="w-[190px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["connected", "pending", "disconnected", "stubbed"] as Status[]).map((st) => (
                        <SelectItem key={st} value={st}>
                          {statusMeta[st].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Tip: mark “Website” + “Affiliate links” as <span className="font-medium text-foreground">connected</span> once you’ve provided URLs.
            </p>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || sourcesQuery.isLoading}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

