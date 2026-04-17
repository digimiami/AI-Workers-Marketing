"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type AgentLogRow = {
  id: string;
  run_id: string;
  level: string;
  message: string;
  data: Record<string, unknown>;
  created_at: string;
};

type EmailLogRow = {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

export function LogsClient({ organizationId }: { organizationId: string }) {
  const logsQuery = useQuery({
    queryKey: ["admin-logs", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/logs?organizationId=${organizationId}&limit=50`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as {
        ok: boolean;
        audit: AuditRow[];
        agent: AgentLogRow[];
        email: EmailLogRow[];
      };
    },
  });

  const audit = logsQuery.data?.audit ?? [];
  const agent = logsQuery.data?.agent ?? [];
  const email = logsQuery.data?.email ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground">Audit trail, agent execution logs, and email delivery.</p>
      </div>

      {logsQuery.isError ? (
        <p className="text-sm text-destructive">Failed to load logs.</p>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Audit</CardTitle>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No audit entries.
                    </TableCell>
                  </TableRow>
                ) : (
                  audit.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.entity_type ?? "—"} {a.entity_id ? `· ${a.entity_id.slice(0, 8)}…` : ""}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Agent logs</CardTitle>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No agent logs.
                    </TableCell>
                  </TableRow>
                ) : (
                  agent.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{l.level}</TableCell>
                      <TableCell className="max-w-md text-sm">{l.message}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">{l.run_id.slice(0, 8)}…</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Email logs</CardTitle>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {email.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No email logs.
                    </TableCell>
                  </TableRow>
                ) : (
                  email.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{e.to_email}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{e.subject}</TableCell>
                      <TableCell className="text-xs">
                        {e.status}
                        {e.error_message ? (
                          <span className="block text-destructive">{e.error_message}</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
