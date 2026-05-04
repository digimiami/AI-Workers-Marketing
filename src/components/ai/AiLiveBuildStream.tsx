"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  Loader2,
  Mail,
  Pencil,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ExecutionStepUi, WorkspaceDisplayBundle } from "@/services/workspace/workspaceDisplayBundle";

type UiStep = { key: string; status: "pending" | "running" | "complete" | "failed"; message?: string };

type RunPoll = {
  ok: boolean;
  run: Record<string, unknown> & {
    stages?: Array<{ id: string; stage_key: string; status?: string }>;
  };
  runTimeline: { steps: ExecutionStepUi[] };
  workspaceDisplay: WorkspaceDisplayBundle | null;
  logs: Array<{ id: string; level: string; message: string; created_at: string; stage_id?: string | null }>;
  outputs: Array<{ id: string; stage_id: string; output_type: string; content: Record<string, unknown> }>;
  workerOutputs: Array<{
    id: string;
    stage_id: string;
    skill_key: string;
    status: string;
    output: Record<string, unknown>;
  }>;
};

function statusTone(status: ExecutionStepUi["status"]) {
  switch (status) {
    case "complete":
      return "text-emerald-500";
    case "running":
      return "text-sky-500";
    case "failed":
      return "text-rose-500";
    case "approval_needed":
      return "text-amber-500";
    default:
      return "text-muted-foreground";
  }
}

function statusIcon(status: ExecutionStepUi["status"]) {
  switch (status) {
    case "complete":
      return CheckCircle2;
    case "running":
      return Loader2;
    case "failed":
      return XCircle;
    case "approval_needed":
      return ShieldAlert;
    default:
      return Circle;
  }
}

function stageKeyToId(run: RunPoll["run"] | undefined): Record<string, string> {
  const rows = Array.isArray(run?.stages) ? (run!.stages as Array<{ id: string; stage_key: string }>) : [];
  const m: Record<string, string> = {};
  for (const r of rows) {
    if (typeof r.stage_key === "string" && typeof r.id === "string") m[r.stage_key] = r.id;
  }
  return m;
}

function previewForStep(step: ExecutionStepUi, data: RunPoll | undefined): string {
  if (!data?.workspaceDisplay) return "";
  const b = data.workspaceDisplay;
  switch (step.id) {
    case "research_offer": {
      const r = b.research;
      if (!r) return "";
      const offer = typeof r.offer_summary === "string" ? r.offer_summary : "";
      const hooks = Array.isArray(r.hook_starters) ? (r.hook_starters as string[]).slice(0, 2).join(" · ") : "";
      return [offer && offer.slice(0, 160), hooks].filter(Boolean).join(" — ");
    }
    case "create_campaign": {
      const n = typeof b.campaign?.name === "string" ? b.campaign.name : "";
      return n ? `Campaign: ${n}` : "";
    }
    case "build_landing": {
      const lp = b.landingPages?.[0];
      if (!lp) return "";
      const h = typeof lp.display_headline === "string" ? lp.display_headline : String(lp.title ?? "");
      return h ? `Headline: ${h.slice(0, 120)}` : "";
    }
    case "build_funnel": {
      const n = typeof b.funnel?.name === "string" ? String(b.funnel.name) : "";
      const c = b.funnelSteps?.length ?? 0;
      return c ? `${n || "Funnel"} · ${c} steps` : "";
    }
    case "generate_content": {
      const a = b.contentAssets?.[0];
      if (!a) return "";
      const ang = Array.isArray(a.angles) ? (a.angles as string[])[0] : "";
      const cap = Array.isArray(a.captions) ? (a.captions as string[])[0] : "";
      return [ang && `Hook: ${String(ang).slice(0, 100)}`, cap && `Caption: ${String(cap).slice(0, 100)}`]
        .filter(Boolean)
        .join(" · ");
    }
    case "generate_ads": {
      const ad = b.adCreatives?.[0];
      if (!ad) return "";
      const h = typeof ad.headline === "string" ? ad.headline : "";
      return h ? `Ad: ${h.slice(0, 120)}` : "";
    }
    case "email_sequence": {
      const t = b.emailTemplates?.[0];
      const sub = t && typeof t.subject === "string" ? t.subject : "";
      return sub ? `Email: ${sub.slice(0, 120)}` : "";
    }
    case "lead_capture": {
      const f = b.leadCaptureForms?.[0];
      return f && typeof f.name === "string" ? `Form: ${f.name}` : "";
    }
    case "analytics": {
      const t = b.analyticsHints?.trackingLinks?.[0];
      return t?.destination_url ? `Tracking: ${t.destination_url.slice(0, 80)}…` : "";
    }
    case "approvals": {
      const pending = (b.approvals ?? []).filter((x) => String(x.status) === "pending").length;
      return pending ? `${pending} pending approvals` : "";
    }
    default:
      return "";
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function funnelFlow(bundle: WorkspaceDisplayBundle | null): string {
  const rows = bundle?.funnelSteps ?? [];
  if (!rows.length) return "";
  const sorted = [...rows].sort((a, b) => Number(a.step_index ?? 0) - Number(b.step_index ?? 0));
  const labels = sorted.map((s) => {
    const t = String(s.step_type ?? "");
    return FUNNEL_LABEL[t] ?? (t ? t : "Step");
  });
  return labels.join(" → ");
}

function workerSnippet(data: RunPoll | undefined, stageKey: string): string {
  if (!data) return "";
  const map = stageKeyToId(data.run);
  const sid = map[stageKey];
  if (!sid) return "";
  const rows = (data.workerOutputs ?? []).filter((w) => String(w.stage_id) === sid);
  if (!rows.length) return "";
  const last = rows[rows.length - 1];
  const o = last.output ?? {};
  const keys = Object.keys(o).filter((k) => !["provider_mode", "provider"].includes(k));
  const pick = keys.slice(0, 2).map((k) => `${k}: ${JSON.stringify(o[k]).slice(0, 80)}`);
  return pick.join(" · ");
}

const FUNNEL_LABEL: Record<string, string> = {
  landing: "Landing",
  form: "Lead capture",
  bridge: "Bridge",
  cta: "CTA",
  thank_you: "Thank you",
  email_trigger: "Nurture",
};

export function AiLiveBuildStream(props: {
  /** If provided, uses the real marketing pipeline polling view */
  pipelineRunId?: string | null;
  /** If provided, renders a simple hook-driven checklist view */
  steps?: UiStep[];
  isRunning?: boolean;
  errors?: Array<{ step?: string; message: string }>;
  className?: string;
}) {
  if (props.steps) {
    return (
      <Card className={cn("border-border/60 bg-card/40 backdrop-blur-sm", props.className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{props.isRunning ? "AI Building…" : "Live build"}</CardTitle>
          <CardDescription>
            {props.isRunning ? "Streaming progress…" : "Waiting for run…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="space-y-2">
            {props.steps.map((s) => (
              <li key={s.key} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    "mt-0.5",
                    s.status === "complete"
                      ? "text-emerald-500"
                      : s.status === "running"
                        ? "text-sky-500"
                        : s.status === "failed"
                          ? "text-rose-500"
                          : "text-muted-foreground",
                  )}
                >
                  {s.status === "complete" ? "✔" : s.status === "failed" ? "✖" : "•"}
                </span>
                <span className={cn(s.status === "complete" ? "text-emerald-500" : s.status === "failed" ? "text-rose-500" : "")}>
                  {s.message || s.key}
                </span>
              </li>
            ))}
          </ul>

          {(props.errors ?? []).length ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-200/90">
              {(props.errors ?? []).slice(-3).map((e, i) => (
                <div key={i}>
                  {e.step ? <span className="font-mono">{e.step}</span> : "error"}: {e.message}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const q = useQuery({
    queryKey: ["marketing-pipeline-run", props.pipelineRunId ?? null],
    enabled: Boolean(props.pipelineRunId),
    refetchInterval: (query) => {
      const d = query.state.data as RunPoll | undefined;
      const st = String(d?.run?.status ?? "");
      if (st === "running" || st === "pending") return 1500;
      if (st === "needs_approval") return 3000;
      return false;
    },
    queryFn: async () => {
      if (!props.pipelineRunId) throw new Error("Missing pipelineRunId");
      const res = await fetch(`/api/admin/marketing-pipeline/runs/${props.pipelineRunId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as RunPoll;
    },
  });

  const data = q.data;
  const steps = data?.runTimeline?.steps ?? [];
  const bundle = data?.workspaceDisplay ?? null;
  const runStatus = typeof data?.run?.status === "string" ? data.run.status : "pending";

  const funnelSteps = React.useMemo(() => {
    const rows = bundle?.funnelSteps ?? [];
    return [...rows].sort((a, b) => Number(a.step_index ?? 0) - Number(b.step_index ?? 0));
  }, [bundle?.funnelSteps]);

  const campaignId =
    (data?.run?.campaign_id && String((data.run as Record<string, unknown>).campaign_id)) ||
    (bundle?.campaignId ? String(bundle.campaignId) : null);
  const campaign = bundle?.campaign ?? null;
  const landing = bundle?.landingPages?.[0] ?? null;
  const research = bundle?.research ?? null;

  const contentCount = bundle?.contentAssets?.length ?? 0;
  const emailCount = bundle?.emailSequenceSteps?.length ?? 0;
  const hookCount = (bundle?.research && Array.isArray((bundle.research as Record<string, unknown>).hook_starters))
    ? strArr((bundle.research as Record<string, unknown>).hook_starters).length
    : null;
  const scriptsCount = Array.isArray(bundle?.contentAssets)
    ? (bundle!.contentAssets ?? []).filter((a) => typeof a.script_markdown === "string" && a.script_markdown.trim()).length
    : null;
  const captionsCount = Array.isArray(bundle?.contentAssets)
    ? (bundle!.contentAssets ?? []).reduce((acc, a) => acc + (Array.isArray(a.captions) ? (a.captions as unknown[]).length : 0), 0)
    : null;

  return (
    <Card className={cn("border-border/60 bg-card/40 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Live build (streaming)</CardTitle>
        <CardDescription>
          Status: <span className="font-mono text-foreground">{runStatus}</span>
          {q.isFetching ? <span className="ml-2 text-xs text-muted-foreground">· updating…</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Streaming feed (matches the “single surface” UX) */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Research</div>
              <Badge variant="outline" className="text-[10px] capitalize">
                {research && Object.keys(research).length ? "ready" : runStatus === "running" ? "running" : "pending"}
              </Badge>
            </div>
            {research && Object.keys(research).length ? (
              <div className="text-xs space-y-1">
                {str((research as Record<string, unknown>).audience_summary) ? (
                  <div>
                    <span className="text-muted-foreground">Audience:</span> {str((research as Record<string, unknown>).audience_summary)}
                  </div>
                ) : null}
                {strArr((research as Record<string, unknown>).pain_points).length ? (
                  <div>
                    <span className="text-muted-foreground">Pain points:</span>{" "}
                    {strArr((research as Record<string, unknown>).pain_points).slice(0, 4).join(", ")}
                  </div>
                ) : null}
                {strArr((research as Record<string, unknown>).hook_starters).length ? (
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Hooks:</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {strArr((research as Record<string, unknown>).hook_starters)
                        .slice(0, 3)
                        .map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-muted-foreground">Researching offer…</div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Researching offer…</div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Campaign</div>
              <Badge variant="outline" className="text-[10px] capitalize">
                {campaignId && campaign ? "created" : "pending"}
              </Badge>
            </div>
            {campaignId && campaign ? (
              <>
                <div className="text-xs">
                  <div className="font-medium">{str(campaign.name) || "Campaign"}</div>
                  {str(campaign.target_audience) ? (
                    <div className="text-muted-foreground">Audience: {str(campaign.target_audience)}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ size: "sm" })}>
                    Open
                  </Link>
                  <Link
                    href={`/admin/campaigns/${campaignId}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Campaign not created yet.</div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Landing page</div>
              <Badge variant="outline" className="text-[10px] capitalize">
                {landing ? "created" : "pending"}
              </Badge>
            </div>
            {landing ? (
              <>
                <div className="text-xs space-y-1">
                  {str(landing.display_headline) || str(landing.title) ? (
                    <div>
                      <span className="text-muted-foreground">Headline:</span>{" "}
                      {str(landing.display_headline) || str(landing.title)}
                    </div>
                  ) : null}
                  {str(landing.primary_cta_label) ? (
                    <div>
                      <span className="text-muted-foreground">CTA:</span> {str(landing.primary_cta_label)}
                    </div>
                  ) : null}
                </div>
                {campaignId ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/f/${campaignId}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
                    >
                      Preview <ExternalLink className="h-3 w-3" />
                    </Link>
                    <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Edit
                    </Link>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Landing page not created yet.</div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Funnel</div>
              <Badge variant="outline" className="text-[10px] capitalize">
                {funnelSteps.length ? "created" : "pending"}
              </Badge>
            </div>
            {funnelSteps.length ? (
              <>
                <div className="text-xs text-muted-foreground">{funnelFlow(bundle) || `${funnelSteps.length} steps`}</div>
                {campaignId ? (
                  <Link href={`/f/${campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Open funnel
                  </Link>
                ) : null}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Funnel not created yet.</div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Content</div>
              <Badge variant="outline" className="text-[10px] capitalize">
                {contentCount ? "generated" : "pending"}
              </Badge>
            </div>
            {contentCount ? (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {hookCount !== null ? <div>✓ {hookCount} hooks</div> : null}
                {scriptsCount !== null ? <div>✓ {scriptsCount} scripts</div> : null}
                {captionsCount !== null ? <div>✓ {captionsCount} captions</div> : null}
                {campaignId ? (
                  <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    View content
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Generating content…</div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-semibold">Email sequence</div>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize">
                {emailCount ? "created" : "pending"}
              </Badge>
            </div>
            {emailCount ? (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>✓ {emailCount} emails</div>
                {campaignId ? (
                  <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    View emails
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Creating sequence…</div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Tracking</div>
              <Badge variant="outline" className="text-[10px] capitalize">
                {(bundle?.analyticsHints?.trackingLinks?.length ?? 0) ? "ready" : "pending"}
              </Badge>
            </div>
            {(bundle?.analyticsHints?.trackingLinks?.length ?? 0) ? (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>✓ Analytics events</div>
                <div>✓ Tracking link</div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Setting up tracking…</div>
            )}
          </div>
        </div>

        {funnelSteps.length ? (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Funnel flow</div>
            <div className="flex flex-wrap items-center gap-1 text-[11px] sm:text-xs">
              {funnelSteps.map((s, i) => {
                const t = String(s.step_type ?? "");
                const label = FUNNEL_LABEL[t] ?? (t ? t : "Step");
                return (
                  <React.Fragment key={String(s.id)}>
                    {i > 0 ? <span className="text-muted-foreground px-0.5">→</span> : null}
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-1 font-medium">{label}</span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Detailed execution timeline (optional, below the streaming feed) */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Execution details</div>
          {steps.map((step, idx) => {
            const Icon = statusIcon(step.status);
            const textPreview = previewForStep(step, data) || workerSnippet(data, step.stageKey);
            return (
              <details
                key={step.id}
                className="group rounded-xl border border-border/60 bg-background/40 open:shadow-sm"
                open={step.status === "running"}
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/60 text-xs font-semibold text-muted-foreground">
                    {idx + 1}
                  </div>
                  <Icon className={cn("h-4 w-4 shrink-0", statusTone(step.status), step.status === "running" && "animate-spin")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{step.title}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {step.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    {textPreview ? (
                      <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{textPreview}</div>
                    ) : (
                      <div className="mt-1 text-[11px] text-muted-foreground">Waiting for outputs…</div>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border/50 bg-muted/15 px-3 py-2 text-[11px] space-y-2">
                  <div className="grid gap-1 sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Workers</span>
                      <div className="font-medium">{step.worker}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Creates</span>
                      <div className="font-medium">{step.creates}</div>
                    </div>
                  </div>
                  {data?.outputs?.length ? (
                    <div>
                      <div className="mb-1 font-medium text-muted-foreground">Stage outputs</div>
                      <div className="max-h-40 overflow-auto rounded-md border border-border/50 bg-background/60 p-2 font-mono space-y-1">
                        {data.outputs
                          .filter((o) => {
                            const map = stageKeyToId(data.run);
                            return String(o.stage_id) === map[step.stageKey];
                          })
                          .slice(-4)
                          .map((o) => (
                            <div key={o.id} className="whitespace-pre-wrap break-words">
                              <span className="text-muted-foreground">{o.output_type}</span>
                              <pre className="mt-0.5 text-[10px] leading-snug">{JSON.stringify(o.content ?? {}, null, 2).slice(0, 900)}</pre>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                  {data?.logs?.length ? (
                    <div>
                      <div className="mb-1 font-medium text-muted-foreground">Logs</div>
                      <div className="max-h-32 overflow-auto rounded-md border border-border/50 bg-background/60 p-2 font-mono space-y-1">
                        {data.logs.slice(-10).map((l) => (
                          <div key={l.id} className="whitespace-pre-wrap break-words">
                            <span className="text-muted-foreground">{new Date(l.created_at).toLocaleTimeString()}</span>{" "}
                            <span className={l.level === "error" ? "text-destructive" : ""}>{l.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default AiLiveBuildStream;
