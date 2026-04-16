"use client";

import * as React from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Approval = {
  id: string;
  status: string;
  approval_type: string;
  agent_run_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export function ApprovalsQueueClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [reasons, setReasons] = React.useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["openclaw-approvals", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/openclaw/approvals?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; approvals: Approval[] };
    },
  });

  const decide = useMutation({
    mutationFn: async (vars: {
      id: string;
      decision: "approved" | "rejected";
      reason?: string;
    }) => {
      const res = await fetch(`/api/admin/openclaw/approvals/${vars.id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          decision: vars.decision,
          reason: vars.reason,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Decision recorded");
      await qc.invalidateQueries({ queryKey: ["openclaw-approvals", organizationId] });
      await qc.invalidateQueries({ queryKey: ["openclaw-runs", organizationId] });
      await qc.invalidateQueries({ queryKey: ["openclaw-run", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = q.data?.approvals ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approval queue</h1>
        <p className="text-sm text-muted-foreground">
          Publishing, email, affiliate activations, and OpenClaw agent outputs awaiting review.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pending & recent</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">Failed to load approvals.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Run</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">{a.approval_type}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{a.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {a.agent_run_id ? (
                        <Link
                          href={`/admin/ai-workers/runs/${a.agent_run_id}`}
                          className="text-sm underline underline-offset-4"
                        >
                          View run
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <Textarea
                        rows={2}
                        className="text-xs"
                        placeholder="Decision note"
                        value={reasons[a.id] ?? ""}
                        onChange={(e) =>
                          setReasons((m) => ({ ...m, [a.id]: e.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {a.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              decide.mutate({
                                id: a.id,
                                decision: "approved",
                                reason: (reasons[a.id] ?? "").trim() || undefined,
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const reason = (reasons[a.id] ?? "").trim();
                              if (!reason) {
                                toast.error("Add a rejection reason in the note field.");
                                return;
                              }
                              decide.mutate({
                                id: a.id,
                                decision: "rejected",
                                reason,
                              });
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
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
