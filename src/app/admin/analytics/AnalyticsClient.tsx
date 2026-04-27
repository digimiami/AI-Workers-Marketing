"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type EventRow = {
  id: string;
  event_name: string;
  properties: Record<string, unknown>;
  source: string;
  session_id: string | null;
  created_at: string;
  campaign_id: string | null;
  campaign_name: string | null;
};

export function AnalyticsClient({ organizationId }: { organizationId: string }) {
  const eventsQuery = useQuery({
    queryKey: ["analytics-events", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/events?organizationId=${organizationId}&limit=150`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as {
        ok: boolean;
        events: EventRow[];
        topEvents: { event_name: string; count: number }[];
      };
    },
  });

  const analyticsPayload = eventsQuery.data;
  const events = Array.isArray(analyticsPayload?.events) ? analyticsPayload.events : [];
  const top = Array.isArray(analyticsPayload?.topEvents) ? analyticsPayload.topEvents : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Recent ingested events for this organization (analytics_events).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top event names (in loaded window)</CardTitle>
        </CardHeader>
        <CardContent>
          {eventsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : top.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-sm">
              {top.map((t) => (
                <li
                  key={t.event_name}
                  className="rounded-full border border-border/70 bg-muted/40 px-3 py-1"
                >
                  <span className="font-medium">{t.event_name}</span>
                  <span className="text-muted-foreground"> · {t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {eventsQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load analytics.</p>
          ) : eventsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Session</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{e.event_name}</TableCell>
                    <TableCell className="text-muted-foreground">{e.campaign_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{e.source}</TableCell>
                    <TableCell className="max-w-[140px] truncate font-mono text-[10px] text-muted-foreground">
                      {e.session_id ?? "—"}
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
