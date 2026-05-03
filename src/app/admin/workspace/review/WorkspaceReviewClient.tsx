"use client";

import * as React from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { WorkspaceDisplayBundle } from "@/services/workspace/workspaceDisplayBundle";

type WorkspaceContext = {
  ok: boolean;
  workspaceDisplay?: WorkspaceDisplayBundle | null;
  campaign: any;
  funnel: any | null;
  funnel_steps: any[];
  content_assets: any[];
  email_templates: any[];
  email_sequences: any[];
  email_sequence_steps: any[];
  worker_assignments: any[];
  approvals: any[];
  logs: any[];
  tool_calls: any[];
};

export function WorkspaceReviewClient({
  organizationId,
  campaignId,
}: {
  organizationId: string;
  campaignId: string;
}) {
  const ctxQuery = useQuery({
    queryKey: ["workspace-context", organizationId, campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${campaignId}?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as WorkspaceContext;
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (section: string) => {
      const res = await fetch("/api/workspace/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, campaignId, section }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      toast.success("Retry started");
      ctxQuery.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Retry failed"),
  });

  const sectionAction = useMutation({
    mutationFn: async (args: {
      section: "funnel" | "content" | "email" | "cta";
      action: "approve" | "reject" | "deploy";
      reason?: string;
    }) => {
      const res = await fetch("/api/workspace/section-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, campaignId, ...args }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      toast.success("Section updated");
      ctxQuery.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  const data = ctxQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace review</h1>
          <p className="text-sm text-muted-foreground">
            Review what the Single Brain created. Everything here is draft/stub unless explicitly connected to a live provider.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "outline" })}>
            Open campaign
          </Link>
          <Button
            variant="outline"
            onClick={() => ctxQuery.refetch()}
            disabled={ctxQuery.isFetching}
          >
            Refresh
          </Button>
        </div>
      </div>

      {ctxQuery.isError ? <p className="text-sm text-destructive">Failed to load workspace context.</p> : null}

      {data?.workspaceDisplay?.research && Object.keys(data.workspaceDisplay.research).length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Research</CardTitle>
            <p className="text-xs text-muted-foreground">Offer, audience, pain points, and positioning from the pipeline.</p>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {typeof (data.workspaceDisplay.research as Record<string, unknown>).offer_summary === "string" ? (
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-xs text-muted-foreground">Offer summary</div>
                <div className="mt-1">{(data.workspaceDisplay.research as Record<string, unknown>).offer_summary as string}</div>
              </div>
            ) : null}
            {Array.isArray((data.workspaceDisplay.research as Record<string, unknown>).pain_points) ? (
              <div className="rounded-lg border border-border/60 p-2 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Pain points</div>
                <ul className="mt-1 list-disc pl-4">
                  {((data.workspaceDisplay.research as Record<string, unknown>).pain_points as string[]).slice(0, 8).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Campaign</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="font-medium">{data?.campaign?.name ?? (ctxQuery.isLoading ? "…" : "—")}</div>
            <div className="text-xs text-muted-foreground mt-1">{data?.campaign?.status ?? ""}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Funnel steps</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tracking-tight">
            {ctxQuery.isLoading ? "…" : (data?.funnel_steps?.length ?? 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approvals</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tracking-tight">
            {ctxQuery.isLoading ? "…" : (data?.approvals?.length ?? 0)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Funnel</CardTitle>
            <p className="text-xs text-muted-foreground">Steps + lead capture wiring metadata.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => retryMutation.mutate("funnel")} disabled={retryMutation.isPending}>
              Regenerate
            </Button>
            <Button
              variant="outline"
              onClick={() => sectionAction.mutate({ section: "funnel", action: "approve" })}
              disabled={sectionAction.isPending}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => sectionAction.mutate({ section: "funnel", action: "deploy" })}
              disabled={sectionAction.isPending}
            >
              Deploy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Slug</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.funnel_steps ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.step_index}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.step_type}</TableCell>
                  <TableCell className="font-mono text-xs">{s.slug}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Content assets</CardTitle>
            <p className="text-xs text-muted-foreground">Drafts created by workers (stub or live provider).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => retryMutation.mutate("content")} disabled={retryMutation.isPending}>
              Regenerate
            </Button>
            <Button
              variant="outline"
              onClick={() => sectionAction.mutate({ section: "content", action: "approve" })}
              disabled={sectionAction.isPending}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => sectionAction.mutate({ section: "content", action: "deploy" })}
              disabled={sectionAction.isPending}
            >
              Deploy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.content_assets ?? []).slice(0, 30).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="max-w-[520px] truncate">{a.title}</TableCell>
                  <TableCell className="font-mono text-xs">{a.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator className="my-4" />
          <Link href="/admin/content" className="text-sm underline underline-offset-4">
            Open content module
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Email</CardTitle>
            <p className="text-xs text-muted-foreground">Templates + sequence steps (draft, approvals required to send).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => retryMutation.mutate("email")} disabled={retryMutation.isPending}>
              Regenerate
            </Button>
            <Button
              variant="outline"
              onClick={() => sectionAction.mutate({ section: "email", action: "approve" })}
              disabled={sectionAction.isPending}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => sectionAction.mutate({ section: "email", action: "deploy" })}
              disabled={sectionAction.isPending}
            >
              Deploy
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium">Templates</div>
            <div className="text-xs text-muted-foreground mb-2">{data?.email_templates?.length ?? 0} total</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.email_templates ?? []).slice(0, 10).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-[260px] truncate">{t.name}</TableCell>
                    <TableCell className="max-w-[520px] truncate">{t.subject}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <div className="text-sm font-medium">Sequence steps</div>
            <div className="text-xs text-muted-foreground mb-2">{data?.email_sequence_steps?.length ?? 0} total</div>
          </div>

          <Link href="/admin/email" className="text-sm underline underline-offset-4">
            Open email module
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Workers + runs</CardTitle>
            <p className="text-xs text-muted-foreground">Assignments plus latest tool calls.</p>
          </div>
          <Button variant="outline" onClick={() => retryMutation.mutate("workers")} disabled={retryMutation.isPending}>
            Retry workers
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium">Assigned workers</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.worker_assignments ?? []).map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.agents?.key}</TableCell>
                    <TableCell>{w.agents?.name}</TableCell>
                    <TableCell className="font-mono text-xs">{w.agents?.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <div className="text-sm font-medium">Latest tool calls</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>OK</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.tool_calls ?? []).slice(0, 10).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.tool_name}</TableCell>
                    <TableCell className="font-mono text-xs">{String(c.ok)}</TableCell>
                    <TableCell className="font-mono text-xs">{String(c.created_at ?? "").slice(0, 19)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/ai-workers/runs" className="text-sm underline underline-offset-4">
              Open runs
            </Link>
            <Link href="/admin/approvals" className="text-sm underline underline-offset-4">
              Open approvals
            </Link>
            <Link href="/admin/logs" className="text-sm underline underline-offset-4">
              Open logs
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

