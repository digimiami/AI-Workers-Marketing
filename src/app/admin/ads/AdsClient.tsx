"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type CampaignRow = {
  id: string;
  campaign_id: string;
  platform: string;
  name: string;
  objective: string | null;
  status: string;
  daily_budget: number | null;
  destination_url: string | null;
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
    leads: number;
    ctr: number;
    cpl: number | null;
  };
};

const statusPresets = ["draft", "active", "paused", "archived"] as const;

export function AdsClient(props: { organizationId: string }) {
  const qc = useQueryClient();
  const [statusById, setStatusById] = React.useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["admin-ads-campaigns", props.organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ads/campaigns?organizationId=${encodeURIComponent(props.organizationId)}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; campaigns: CampaignRow[] };
    },
  });

  const rows = Array.isArray(q.data?.campaigns) ? q.data!.campaigns : [];

  React.useEffect(() => {
    setStatusById((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (next[r.id] === undefined) next[r.id] = r.status;
      }
      return next;
    });
  }, [rows]);

  const patchAd = useMutation({
    mutationFn: async (vars: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/ads/campaigns/${vars.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: props.organizationId, status: vars.status }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Ad campaign saved");
      await qc.invalidateQueries({ queryKey: ["admin-ads-campaigns", props.organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const deleteAd = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/ads/campaigns/${id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: props.organizationId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Ad campaign deleted");
      await qc.invalidateQueries({ queryKey: ["admin-ads-campaigns", props.organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ads</h1>
        <p className="text-sm text-muted-foreground">Paid campaigns + recent performance snapshots (stub/live).</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">Failed to load ads.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ad campaigns yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs">{r.platform}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={statusById[r.id] ?? r.status}
                        onValueChange={(v) => setStatusById((m) => ({ ...m, [r.id]: String(v) }))}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...new Set([...statusPresets, r.status])].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right text-xs">{r.metrics.spend.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-xs">{r.metrics.clicks}</TableCell>
                    <TableCell className="text-right text-xs">{r.metrics.leads}</TableCell>
                    <TableCell className="text-right text-xs">
                      {r.metrics.cpl == null ? "—" : r.metrics.cpl.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={patchAd.isPending}
                          onClick={() =>
                            patchAd.mutate({ id: r.id, status: statusById[r.id] ?? r.status })
                          }
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleteAd.isPending}
                          onClick={() => {
                            if (!window.confirm("Delete this ad campaign?")) return;
                            deleteAd.mutate(r.id);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
