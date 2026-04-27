"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ReportRow = {
  id: string;
  campaign_id: string | null;
  week_start: string;
  week_end: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export function ReportsClient({ organizationId }: { organizationId: string }) {
  const reportQuery = useQuery({
    queryKey: ["weekly-reports", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; reports: ReportRow[] };
    },
  });

  const rows = reportQuery.data?.reports ?? [];
  const generated = rows.filter((r) => r.status === "generated" || r.status === "sent").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reports</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tracking-tight">{reportQuery.isLoading ? "…" : rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Generated</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tracking-tight">{reportQuery.isLoading ? "…" : generated}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Next step</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Add cron generation + delivery rows in <code className="font-mono text-[11px]">report_deliveries</code>.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent reports</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Week</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 120).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.status}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.week_start} → {r.week_end}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.campaign_id ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{new Date(r.updated_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {reportQuery.isError ? <p className="mt-3 text-sm text-destructive">Failed to load weekly reports.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

