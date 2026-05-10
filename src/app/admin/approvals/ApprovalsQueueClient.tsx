"use client";

import * as React from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  target_entity_type?: string | null;
  target_entity_id?: string | null;
};

export function ApprovalsQueueClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [reasons, setReasons] = React.useState<Record<string, string>>({});
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const q = useQuery({
    queryKey: ["openclaw-approvals", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/openclaw/approvals?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; approvals: Approval[] };
    },
  });

  const detailQuery = useQuery({
    queryKey: ["openclaw-approval-detail", organizationId, detailId],
    enabled: Boolean(detailId),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/openclaw/approvals/${detailId}?organizationId=${organizationId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as {
        ok: boolean;
        approval: any;
        campaign: any | null;
        run: any | null;
        outputs: any[];
        target: any | null;
      };
    },
  });

  const saveNote = useMutation({
    mutationFn: async (vars: { id: string; note: string }) => {
      const res = await fetch(`/api/admin/openclaw/approvals/${vars.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          operator_note: vars.note,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Note saved");
      await qc.invalidateQueries({ queryKey: ["openclaw-approvals", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const removeApproval = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/openclaw/approvals/${id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Removed");
      await qc.invalidateQueries({ queryKey: ["openclaw-approvals", organizationId] });
      setDetailId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
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
                  <TableHead className="text-right w-[220px]">Actions</TableHead>
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
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={saveNote.isPending}
                          onClick={() =>
                            saveNote.mutate({ id: a.id, note: (reasons[a.id] ?? "").trim() })
                          }
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDetailId(a.id)}
                        >
                          Inspect
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={removeApproval.isPending}
                          onClick={() => {
                            if (!window.confirm("Remove this approval row from the queue?")) return;
                            removeApproval.mutate(a.id);
                          }}
                        >
                          Delete
                        </Button>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Approval detail</DialogTitle>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : detailQuery.isError ? (
            <div className="text-sm text-destructive">Failed to load detail.</div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">Type</div>
                  <div className="font-medium">{detailQuery.data?.approval?.approval_type}</div>
                  <div className="mt-2 text-xs text-muted-foreground">Status</div>
                  <div className="font-mono text-xs">{detailQuery.data?.approval?.status}</div>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">Target</div>
                  <div className="font-mono text-xs">
                    {detailQuery.data?.approval?.target_entity_type ?? "—"} ·{" "}
                    {detailQuery.data?.approval?.target_entity_id
                      ? String(detailQuery.data?.approval?.target_entity_id).slice(0, 8) + "…"
                      : "—"}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Campaign</div>
                  <div className="text-sm">{detailQuery.data?.campaign?.name ?? "—"}</div>
                </div>
              </div>

              {detailQuery.data?.run?.id ? (
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Source run</div>
                      <div className="font-mono text-xs">{detailQuery.data.run.id}</div>
                      <div className="text-xs text-muted-foreground">
                        {detailQuery.data.run.agents?.name ?? "—"} ({detailQuery.data.run.agents?.key ?? "—"})
                      </div>
                    </div>
                    <Link
                      href={`/admin/ai-workers/runs/${detailQuery.data.run.id}`}
                      className="text-sm underline underline-offset-4"
                    >
                      Open run
                    </Link>
                  </div>
                </div>
              ) : null}

              {detailQuery.data?.target ? (
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">Target snapshot</div>
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/40 p-3 text-xs">
                    {JSON.stringify(detailQuery.data.target, null, 2)}
                  </pre>
                </div>
              ) : null}

              <div className="rounded-lg border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Payload</div>
                <pre className="mt-2 max-h-56 overflow-auto rounded bg-muted/40 p-3 text-xs">
                  {JSON.stringify(detailQuery.data?.approval?.payload ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
