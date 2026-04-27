"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ConversationRow = {
  id: string;
  status: string;
  lead_id: string | null;
  lead_score: number;
  started_at: string;
  last_message_at: string | null;
  campaign_id: string | null;
};

export function ChatAdminClient({ organizationId }: { organizationId: string }) {
  const convQuery = useQuery({
    queryKey: ["chat-conversations", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/chat/conversations?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; conversations: ConversationRow[] };
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tracking-tight">
            {convQuery.isLoading ? "…" : (convQuery.data?.conversations?.length ?? 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tracking-tight">
            {convQuery.isLoading
              ? "…"
              : (convQuery.data?.conversations ?? []).filter((c) => c.status === "converted").length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hot leads</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tracking-tight">
            {convQuery.isLoading
              ? "…"
              : (convQuery.data?.conversations ?? []).filter((c) => (c.lead_score ?? 0) >= 70).length}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(convQuery.data?.conversations ?? []).slice(0, 100).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.status}</TableCell>
                  <TableCell className="font-mono text-xs">{c.lead_id ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{c.lead_score ?? 0}</TableCell>
                  <TableCell className="font-mono text-xs">{new Date(c.started_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {convQuery.isError ? (
            <p className="mt-3 text-sm text-destructive">Failed to load conversations.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

