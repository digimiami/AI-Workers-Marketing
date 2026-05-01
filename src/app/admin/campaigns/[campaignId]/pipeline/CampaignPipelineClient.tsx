"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type StageKey = "research" | "strategy" | "creation" | "execution" | "optimization";

function asRows<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length ? v : null;
}

function badge(status: string) {
  const base = "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium";
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    running: "bg-blue-500/10 text-blue-600",
    completed: "bg-emerald-500/10 text-emerald-700",
    failed: "bg-red-500/10 text-red-700",
    needs_approval: "bg-amber-500/10 text-amber-700",
  };
  return <span className={`${base} ${map[status] ?? map.pending}`}>{status}</span>;
}

const stageOrder: StageKey[] = ["research", "strategy", "creation", "execution", "optimization"];

export function CampaignPipelineClient(props: { organizationId: string; campaignId: string }) {
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);
  const { toast } = useToast();

  const campaignRunsQuery = useQuery({
    queryKey: ["marketing-pipeline-campaign", props.campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/marketing-pipeline/campaign/${props.campaignId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as unknown;
    },
    refetchInterval: 4000,
  });

  React.useEffect(() => {
    const d = asRecord(campaignRunsQuery.data);
    const latest = asString(d.latestRunId);
    if (latest && !activeRunId) setActiveRunId(latest);
  }, [campaignRunsQuery.data, activeRunId]);

  const runStatusQuery = useQuery({
    queryKey: ["marketing-pipeline-run", activeRunId],
    enabled: Boolean(activeRunId),
    queryFn: async () => {
      const runId = activeRunId;
      if (!runId) return null;
      const res = await fetch(`/api/admin/marketing-pipeline/runs/${runId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as unknown;
    },
    refetchInterval: 2000,
  });

  const runResp = asRecord(runStatusQuery.data);
  const run = asRecord(runResp.run);
  const stages = asRows<Record<string, unknown>>(run.stages);
  const outputs = asRows<Record<string, unknown>>(run.outputs);
  const logs = asRows<Record<string, unknown>>(run.logs);
  const approvals = asRows<Record<string, unknown>>(run.approvals);

  const stageMap = new Map<string, Record<string, unknown>>();
  for (const s of stages) stageMap.set(String(s.stage_key), s);

  const outputsByStage = new Map<string, Record<string, unknown>[]>();
  for (const o of outputs) {
    const stageId = String(o.stage_id ?? "");
    const list = outputsByStage.get(stageId) ?? [];
    outputsByStage.set(stageId, [...list, o]);
  }

  const logsByStage = new Map<string, Record<string, unknown>[]>();
  for (const l of logs) {
    const stageId = String(l.stage_id ?? "");
    const list = logsByStage.get(stageId) ?? [];
    logsByStage.set(stageId, [...list, l]);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Campaign Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Research → Strategy → Creation → Execution → Optimization
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const latest = asString(asRecord(campaignRunsQuery.data).latestRunId);
                if (latest) setActiveRunId(latest);
              }}
              disabled={campaignRunsQuery.isLoading}
            >
              Load latest run
            </Button>
            <a
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
              href={`/admin/campaigns/${props.campaignId}`}
            >
              Back to campaign
            </a>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">runId</span>
            <code className="rounded bg-muted px-2 py-0.5">{String(run?.id ?? activeRunId ?? "—")}</code>
            {asString(run.status) ? badge(String(run.status)) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a className="underline" href={`/admin/campaigns/${props.campaignId}`}>
              Campaign
            </a>
            {asString(run.campaign_id) ? (
              <a className="underline" href={`/admin/campaigns/${String(run.campaign_id)}/pipeline`}>
                Pipeline view
              </a>
            ) : null}
          </div>
          {asRows<string>(run.errors).length > 0 ? (
            <div className="rounded border border-red-500/20 bg-red-500/5 p-3">
              <div className="font-medium text-red-700">Errors</div>
              <ul className="mt-1 list-disc pl-5">
                {asRows<string>(run.errors).slice(0, 10).map((e, idx) => (
                  <li key={idx} className="text-red-700">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-5">
        {stageOrder.map((key, idx) => {
          const s = stageMap.get(key);
          const stageId = s?.id ? String(s.id) : "";
          const sOutputs = stageId ? outputsByStage.get(stageId) ?? [] : [];
          const sLogs = stageId ? logsByStage.get(stageId) ?? [] : [];
          const runId = String(run.id ?? activeRunId ?? "");
          const stageStatus = typeof s?.status === "string" ? String(s.status) : "pending";

          return (
            <Card key={key} className="relative">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm capitalize">
                  {key} {s?.status ? badge(String(s.status)) : null}
                </CardTitle>
                <div className="text-xs text-muted-foreground">
                  {idx > 0 ? "←" : ""} {idx < stageOrder.length - 1 ? "→" : ""}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Workers</div>
                  <div className="text-xs">
                    {(() => {
                      const workers = asRows<string>(s?.assigned_workers);
                      return workers.length ? workers.join(", ") : "—";
                    })()}
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Outputs</div>
                  {sOutputs.length === 0 ? (
                    <div className="text-xs text-muted-foreground">—</div>
                  ) : (
                    <ul className="space-y-1">
                      {sOutputs.slice(-2).map((o) => (
                        <li key={String(o.id)} className="text-xs">
                          <code className="rounded bg-muted px-1.5 py-0.5">{String(o.output_type ?? "output")}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Logs</div>
                  {sLogs.length === 0 ? (
                    <div className="text-xs text-muted-foreground">—</div>
                  ) : (
                    <ul className="space-y-1">
                      {sLogs.slice(-3).map((l) => (
                        <li key={String(l.id)} className="text-xs">
                          <span className="text-muted-foreground">[{String(l.level)}]</span>{" "}
                          {String(l.message).slice(0, 90)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!runId || key !== "execution" || stageStatus !== "needs_approval"}
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/admin/marketing-pipeline/runs/${encodeURIComponent(runId)}/approve`, {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                        });
                        if (!res.ok) throw new Error(await res.text());
                        toast({ title: "Approved", description: "Applied approval side-effects (sequence/pages/creatives)." });
                        await runStatusQuery.refetch();
                      } catch (e) {
                        toast({ title: "Approve failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
                      }
                    }}
                  >
                    Approve (Execution)
                  </Button>
                  <Button variant="secondary" size="sm" disabled>
                    Rerun stage
                  </Button>
                  <Button variant="secondary" size="sm" disabled>
                    Regenerate output
                  </Button>
                  <Button size="sm" disabled>
                    Move to next stage
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  {key === "execution" && stageStatus === "needs_approval"
                    ? `Pending approvals: ${approvals.filter((a) => String(a.status) === "pending").length}`
                    : "Actions are partially wired (approve), others coming next."}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

