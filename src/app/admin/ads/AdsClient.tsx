"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export function AdsClient(props: { organizationId: string }) {
  const q = useQuery({
    queryKey: ["admin-ads-campaigns", props.organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ads/campaigns?organizationId=${encodeURIComponent(props.organizationId)}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; campaigns: CampaignRow[] };
    },
  });

  const rows = Array.isArray(q.data?.campaigns) ? q.data!.campaigns : [];

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs">{r.platform}</TableCell>
                    <TableCell className="text-xs">{r.status}</TableCell>
                    <TableCell className="text-right text-xs">{r.metrics.spend.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-xs">{r.metrics.clicks}</TableCell>
                    <TableCell className="text-right text-xs">{r.metrics.leads}</TableCell>
                    <TableCell className="text-right text-xs">
                      {r.metrics.cpl == null ? "—" : r.metrics.cpl.toFixed(2)}
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
