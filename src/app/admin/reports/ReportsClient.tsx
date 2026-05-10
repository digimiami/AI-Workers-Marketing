"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ReportRow = {
  id: string;
  campaign_id: string | null;
  week_start: string;
  week_end: string;
  status: string;
  report_markdown: string | null;
  created_at: string;
  updated_at: string;
};

export function ReportsClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [mdById, setMdById] = React.useState<Record<string, string>>({});

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

  React.useEffect(() => {
    setMdById((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (next[r.id] === undefined) next[r.id] = r.report_markdown ?? "";
      }
      return next;
    });
  }, [rows]);

  const saveReport = useMutation({
    mutationFn: async (vars: { id: string; report_markdown: string | null }) => {
      const res = await fetch(`/api/admin/reports/${vars.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          report_markdown: vars.report_markdown,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Report saved");
      await qc.invalidateQueries({ queryKey: ["weekly-reports", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Report deleted");
      await qc.invalidateQueries({ queryKey: ["weekly-reports", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

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
                <TableHead>Notes</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right w-[180px]">Actions</TableHead>
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
                  <TableCell className="min-w-[200px] max-w-[360px]">
                    <Textarea
                      rows={2}
                      className="text-xs font-mono"
                      value={mdById[r.id] ?? ""}
                      onChange={(e) => setMdById((m) => ({ ...m, [r.id]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{new Date(r.updated_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={saveReport.isPending}
                        onClick={() =>
                          saveReport.mutate({
                            id: r.id,
                            report_markdown: (mdById[r.id] ?? "").trim() || null,
                          })
                        }
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleteReport.isPending}
                        onClick={() => {
                          if (!window.confirm("Delete this weekly report?")) return;
                          deleteReport.mutate(r.id);
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
          {reportQuery.isError ? <p className="mt-3 text-sm text-destructive">Failed to load weekly reports.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

