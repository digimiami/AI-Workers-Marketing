"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type GenerationRow = {
  id: string;
  platform: string;
  tone: string | null;
  goal: string | null;
  status: string;
  campaign_id: string | null;
  created_at: string;
};

export function AdCreativeClient({ organizationId }: { organizationId: string }) {
  const genQuery = useQuery({
    queryKey: ["ad-creative-generations", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ad-creative?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; generations: GenerationRow[] };
    },
  });

  const rows = genQuery.data?.generations ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Generations</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tracking-tight">{genQuery.isLoading ? "…" : rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platforms</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tracking-tight">
            {genQuery.isLoading ? "…" : new Set(rows.map((r) => r.platform)).size}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This is a shell</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Next step is the generation UI + saving outputs into <code className="font-mono text-[11px]">content_assets</code>.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent generations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tone</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 120).map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono text-xs">{g.platform}</TableCell>
                  <TableCell className="font-mono text-xs">{g.status}</TableCell>
                  <TableCell className="text-xs">{g.tone ?? "—"}</TableCell>
                  <TableCell className="text-xs">{g.goal ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{new Date(g.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {genQuery.isError ? <p className="mt-3 text-sm text-destructive">Failed to load ad creative generations.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

