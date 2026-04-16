"use client";

import * as React from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { RunHumanGate } from "@/lib/openclaw/types";
import { toast } from "sonner";

async function readApiError(res: Response) {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as { message?: string };
    return j.message ?? raw;
  } catch {
    return raw;
  }
}

function gateBadgeVariant(
  phase: RunHumanGate["phase"],
): "default" | "secondary" | "destructive" | "outline" {
  if (phase === "awaiting_review") return "secondary";
  if (phase === "approved") return "default";
  if (phase === "rejected") return "destructive";
  return "outline";
}

export function RunDetailClient({
  organizationId,
  runId,
}: {
  organizationId: string;
  runId: string;
}) {
  const qc = useQueryClient();
  const [rejectReason, setRejectReason] = React.useState("");
  const [approveNote, setApproveNote] = React.useState("");

  const runQuery = useQuery({
    queryKey: ["openclaw-run", organizationId, runId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/openclaw/runs/${runId}?organizationId=${organizationId}`,
      );
      if (!res.ok) throw new Error(await readApiError(res));
      return (await res.json()) as {
        ok: boolean;
        run: Record<string, unknown>;
        humanGate: RunHumanGate;
      };
    },
  });

  const logsQuery = useQuery({
    queryKey: ["openclaw-run-logs", organizationId, runId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/openclaw/runs/${runId}/logs?organizationId=${organizationId}`,
      );
      if (!res.ok) throw new Error(await readApiError(res));
      return (await res.json()) as { ok: boolean; logs: Record<string, unknown>[] };
    },
  });

  const outputsQuery = useQuery({
    queryKey: ["openclaw-run-outputs", organizationId, runId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/openclaw/runs/${runId}/outputs?organizationId=${organizationId}`,
      );
      if (!res.ok) throw new Error(await readApiError(res));
      return (await res.json()) as { ok: boolean; outputs: Record<string, unknown>[] };
    },
  });

  const approveMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/openclaw/runs/${runId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          reason: approveNote.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
    },
    onSuccess: async () => {
      toast.success("Output approved");
      await qc.invalidateQueries({ queryKey: ["openclaw-run", organizationId, runId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rejectMut = useMutation({
    mutationFn: async () => {
      const reason = rejectReason.trim() || "Rejected";
      const res = await fetch(`/api/admin/openclaw/runs/${runId}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, reason }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
    },
    onSuccess: async () => {
      toast.success("Output rejected");
      setRejectReason("");
      await qc.invalidateQueries({ queryKey: ["openclaw-run", organizationId, runId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const run = runQuery.data?.run;
  const humanGate = runQuery.data?.humanGate;
  const status = run?.status as string | undefined;
  const agent = run?.agents as { name?: string; key?: string } | undefined;

  const rejectBlocked =
    humanGate?.phase === "awaiting_review" &&
    humanGate.reasonRequired &&
    rejectReason.trim().length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Run detail</h1>
        <p className="text-sm text-muted-foreground font-mono">{runId}</p>
        {run ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Run status</span>
            <Badge variant="outline">{String(status)}</Badge>
            {agent?.name ? (
              <span className="text-muted-foreground">
                · Agent <span className="font-medium text-foreground">{agent.name}</span>
                {agent.key ? (
                  <span className="ml-1 font-mono text-xs">({agent.key})</span>
                ) : null}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {humanGate ? (
        <Card
          className={
            humanGate.phase === "awaiting_review"
              ? "border-amber-500/40 bg-amber-500/[0.04]"
              : humanGate.phase === "rejected"
                ? "border-destructive/30"
                : undefined
          }
        >
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Human approval</CardTitle>
                <CardDescription className="mt-1">
                  Operators sign off on agent output when the agent requires a human gate.
                </CardDescription>
              </div>
              <Badge variant={gateBadgeVariant(humanGate.phase)}>
                {humanGate.phase === "awaiting_review"
                  ? "Awaiting review"
                  : humanGate.phase === "approved"
                    ? "Approved"
                    : humanGate.phase === "rejected"
                      ? "Rejected"
                      : "Not required"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {humanGate.phase === "awaiting_review" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Review structured outputs and logs, then approve for downstream use or reject
                  with a clear reason.
                </p>
                {humanGate.payload && Object.keys(humanGate.payload).length > 0 ? (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <div className="mb-1 font-medium text-foreground">Approval context</div>
                    <pre className="max-h-40 overflow-auto text-xs leading-relaxed">
                      {JSON.stringify(humanGate.payload, null, 2)}
                    </pre>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/admin/approvals"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Open approvals queue
                  </Link>
                </div>
                <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="approve-note">Approval note (optional)</Label>
                    <Textarea
                      id="approve-note"
                      value={approveNote}
                      onChange={(e) => setApproveNote(e.target.value)}
                      rows={2}
                      placeholder="Shown on the approval record for audit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reject-reason">
                      Rejection reason
                      {humanGate.reasonRequired ? (
                        <span className="text-destructive"> (required)</span>
                      ) : null}
                    </Label>
                    <Textarea
                      id="reject-reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      placeholder="What should change before this output is acceptable?"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="default"
                    disabled={approveMut.isPending}
                    onClick={() => approveMut.mutate()}
                  >
                    Approve output
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={rejectMut.isPending || rejectBlocked}
                    onClick={() => rejectMut.mutate()}
                  >
                    Reject output
                  </Button>
                </div>
              </>
            ) : null}

            {humanGate.phase === "approved" ? (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  This run&apos;s output was approved and can be treated as cleared for downstream
                  workflows.
                </p>
                {humanGate.decidedAt ? (
                  <p className="text-muted-foreground">
                    Decided at{" "}
                    <span className="font-medium text-foreground">
                      {new Date(humanGate.decidedAt).toLocaleString()}
                    </span>
                  </p>
                ) : null}
                {humanGate.note ? (
                  <p>
                    <span className="text-muted-foreground">Note: </span>
                    {humanGate.note}
                  </p>
                ) : null}
              </div>
            ) : null}

            {humanGate.phase === "rejected" ? (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  This run was rejected. Structured outputs remain for review; do not use them as
                  cleared production content.
                </p>
                {humanGate.decidedAt ? (
                  <p className="text-muted-foreground">
                    Decided at{" "}
                    <span className="font-medium text-foreground">
                      {new Date(humanGate.decidedAt).toLocaleString()}
                    </span>
                  </p>
                ) : null}
                {humanGate.reason ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <div className="text-xs font-medium text-destructive">Reason</div>
                    <p className="mt-1 whitespace-pre-wrap">{humanGate.reason}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {humanGate.phase === "not_applicable" ? (
              <p className="text-sm text-muted-foreground">{humanGate.message}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="outputs">
        <TabsList>
          <TabsTrigger value="outputs">Structured outputs</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="input">Input JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="outputs" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <pre className="text-xs overflow-auto max-h-[480px] bg-muted/40 rounded-lg p-4">
                {JSON.stringify(outputsQuery.data?.outputs ?? [], null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {(logsQuery.data?.logs ?? []).map((l) => (
                <div key={String(l.id)} className="border-b pb-2 text-sm">
                  <div className="text-muted-foreground">
                    {String(l.created_at)} · {String(l.level)}
                  </div>
                  <div>{String(l.message)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="input" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <pre className="text-xs overflow-auto max-h-[480px] bg-muted/40 rounded-lg p-4">
                {JSON.stringify(run?.input ?? {}, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
