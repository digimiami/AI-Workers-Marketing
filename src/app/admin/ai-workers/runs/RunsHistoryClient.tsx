"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RunRow = {
  id: string;
  agent_id: string;
  status: string;
  output_summary: string | null;
  error_message: string | null;
  created_at: string;
  agents: { key: string; name: string } | null;
};

export function RunsHistoryClient({ organizationId }: { organizationId: string }) {
  const runsQuery = useQuery({
    queryKey: ["openclaw-runs", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/openclaw/runs?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; runs: RunRow[] };
    },
  });

  const runs = runsQuery.data?.runs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent run history</h1>
        <p className="text-sm text-muted-foreground">
          OpenClaw runs with status, summaries, and drill-down logs/outputs.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : runsQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load runs.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.agents?.name ?? "—"}
                      <div className="text-xs text-muted-foreground">{r.agents?.key}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                      {r.output_summary ?? r.error_message ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/ai-workers/runs/${r.id}`}
                        className="text-sm underline underline-offset-4"
                      >
                        Open
                      </Link>
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
