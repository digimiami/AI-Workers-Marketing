"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  ExternalLink,
  FileText,
  Funnel,
  ImageIcon,
  LayoutTemplate,
  Mail,
  MousePointerClick,
  Pencil,
  Radar,
  Search,
  Shield,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { WorkspaceDisplayBundle } from "@/services/workspace/workspaceDisplayBundle";
import WorkspaceCard from "@/components/ai/WorkspaceCard";

type RunPoll = {
  ok: boolean;
  run: Record<string, unknown> & { campaign_id?: string | null };
  workspaceDisplay: WorkspaceDisplayBundle | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function pendingCount(bundle: WorkspaceDisplayBundle | null) {
  return (bundle?.approvals ?? []).filter((a) => str(a.status) === "pending").length;
}

export function GeneratedWorkspace(props: {
  organizationId: string;
  pipelineRunId?: string | null;
  /** Optional “simple results” mode (no polling). */
  data?: any;
  className?: string;
}) {
  if (props.data) {
    const d = props.data as Record<string, unknown>;
    return (
      <div className={cn("grid gap-6 md:grid-cols-2", props.className)}>
        <WorkspaceCard title="Campaign" content={d.campaign} />
        <WorkspaceCard title="Landing Page" content={d.landing} />
        <WorkspaceCard title="Funnel" content={d.funnel} />
        <WorkspaceCard title="Content" content={d.content} />
        <WorkspaceCard title="Emails" content={d.emails} />
        <WorkspaceCard title="Analytics" content={d.analytics} />
      </div>
    );
  }

  const qc = useQueryClient();

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

  const bundle = q.data?.workspaceDisplay ?? null;
  const campaignId =
    (q.data?.run?.campaign_id && String(q.data.run.campaign_id)) ||
    (bundle?.campaignId ? String(bundle.campaignId) : null);

  const decide = useMutation({
    mutationFn: async (p: { approvalId: string; decision: "approved" | "rejected"; reason?: string }) => {
      const res = await fetch(`/api/admin/openclaw/approvals/${p.approvalId}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: props.organizationId,
          decision: p.decision,
          reason: p.reason,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Approval updated");
      await qc.invalidateQueries({ queryKey: ["marketing-pipeline-run", props.pipelineRunId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Approval failed"),
  });

  const [rejectReason, setRejectReason] = React.useState<Record<string, string>>({});

  if (!q.data) {
    return (
      <Card className={cn("border-border/60", props.className)}>
        <CardHeader>
          <CardTitle className="text-base">Generated workspace</CardTitle>
          <CardDescription>
            {props.pipelineRunId ? "Loading workspace snapshot…" : "Run the pipeline to generate a workspace."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const c = bundle?.campaign ?? null;
  const research = bundle?.research;
  const pendingApprovals = (bundle?.approvals ?? []).filter((a) => str(a.status) === "pending");
  const anyPending = pendingApprovals.length > 0;

  const approveAll = useMutation({
    mutationFn: async () => {
      if (!anyPending) return;
      await Promise.all(
        pendingApprovals.map((a) =>
          decide.mutateAsync({ approvalId: str(a.id), decision: "approved" }),
        ),
      );
    },
    onSuccess: async () => {
      toast.success("Approved all pending items");
      await qc.invalidateQueries({ queryKey: ["marketing-pipeline-run", props.pipelineRunId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Approve all failed"),
  });

  return (
    <div className={cn("space-y-4", props.className)}>
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-transparent to-sky-500/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Campaign workspace ready
            </div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">AI built your full marketing system</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/ai-command" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Regenerate
            </Link>
            {campaignId ? (
              <Link
                href={`/admin/campaigns/${campaignId}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <a href="#campaign" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Campaign
          </a>
          <a href="#landing" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Landing
          </a>
          <a href="#funnel" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Funnel
          </a>
          <a href="#content" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Content
          </a>
          <a href="#ads" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Ads
          </a>
          <a href="#emails" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Emails
          </a>
          <a href="#leads" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Leads
          </a>
          <a href="#analytics" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Analytics
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="research" className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Research</CardTitle>
            </div>
            <CardDescription>Offer, hooks, and audience signals.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {!research || Object.keys(research).length === 0 ? (
              <p className="text-muted-foreground">Research appears as soon as the first bundle is written.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {str(research.offer_summary) ? (
                  <div className="rounded-lg border border-border/50 bg-background/50 p-2">
                    <div className="text-xs text-muted-foreground">Offer summary</div>
                    <div className="mt-1 leading-snug">{str(research.offer_summary)}</div>
                  </div>
                ) : null}
                {Array.isArray(research.pain_points) && research.pain_points.length ? (
                  <div className="rounded-lg border border-border/50 bg-background/50 p-2 sm:col-span-2">
                    <div className="text-xs text-muted-foreground">Pain points</div>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {(research.pain_points as string[]).slice(0, 8).map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {Array.isArray(research.hook_starters) && (research.hook_starters as string[]).length ? (
                  <div className="rounded-lg border border-border/50 bg-background/50 p-2 sm:col-span-2">
                    <div className="text-xs text-muted-foreground">Hook starters</div>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {(research.hook_starters as string[]).slice(0, 8).map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="campaign" className="border-border/60 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Campaign</CardTitle>
            </div>
            {c ? <Badge variant="outline">{str(c.status) || "draft"}</Badge> : null}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!campaignId || !c ? (
              <p className="text-muted-foreground">Campaign card fills in when the strategy stage creates the record.</p>
            ) : (
              <>
                <div className="font-semibold">{str(c.name)}</div>
                <div className="text-xs text-muted-foreground line-clamp-4">{str(c.description) || str(c.target_audience)}</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ size: "sm" })}>
                    Open
                  </Link>
                  <Link
                    href={`/admin/campaigns/${campaignId}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card id="landing" className="border-border/60 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Landing</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {(bundle?.landingPages?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No landing page yet.</p>
            ) : (
              bundle!.landingPages.slice(0, 3).map((lp) => (
                <div key={str(lp.id)} className="rounded-lg border border-border/50 bg-background/50 p-2 space-y-1">
                  <div className="font-medium">{str(lp.display_headline) || str(lp.title)}</div>
                  <div className="text-xs text-muted-foreground line-clamp-3">{str(lp.display_subheadline) || str(lp.description)}</div>
                  {campaignId ? (
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Edit
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card id="funnel" className="border-border/60 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Funnel className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Funnel</CardTitle>
            </div>
            <CardDescription>{bundle?.funnel ? str(bundle.funnel.name) : "Not linked"}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="text-muted-foreground">{(bundle?.funnelSteps?.length ?? 0)} steps</div>
            <div className="flex flex-wrap gap-1">
              {(bundle?.funnelSteps ?? []).map((s, i) => (
                <Badge key={str(s.id)} variant="secondary" className="font-normal">
                  {i + 1}. {str(s.name)}
                </Badge>
              ))}
            </div>
            {campaignId ? (
              <Link
                href={`/f/${campaignId}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
              >
                Preview <ExternalLink className="h-3 w-3" />
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card id="content" className="border-border/60 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Content</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            {(bundle?.contentAssets?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No content assets yet.</p>
            ) : (
              (bundle?.contentAssets ?? []).slice(0, 6).map((a) => (
                <div key={str(a.id)} className="rounded-md border border-border/40 p-2 space-y-1">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/50 bg-background/50 p-2">
                      <div className="text-[11px] text-muted-foreground">Hook card</div>
                      <div className="mt-1 text-xs font-medium">
                        {Array.isArray(a.angles) && (a.angles as string[]).length ? (a.angles as string[])[0] : str(a.title) || "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/50 p-2">
                      <div className="text-[11px] text-muted-foreground">Script card</div>
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-4">
                        {typeof a.script_markdown === "string" && a.script_markdown.trim()
                          ? a.script_markdown.replaceAll("\n", " ").slice(0, 220)
                          : "—"}
                      </div>
                    </div>
                  </div>
                  {campaignId ? (
                    <div className="pt-1">
                      <Link
                        href={`/admin/campaigns/${campaignId}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        View all content
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card id="ads" className="border-border/60 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Ads</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {(bundle?.adCreatives?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No ad creatives yet.</p>
            ) : (
              (bundle?.adCreatives ?? []).slice(0, 6).map((ad) => (
                <div key={str(ad.id)} className="rounded-md border border-border/40 p-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{str(ad.platform)}</Badge>
                    <span className="font-medium">{str(ad.headline)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-3">{str(ad.primary_text)}</div>
                  {typeof ad.script_markdown === "string" && ad.script_markdown.trim() ? (
                    <pre className="max-h-20 overflow-auto text-[11px] bg-muted/30 p-2 rounded whitespace-pre-wrap">{ad.script_markdown.slice(0, 500)}</pre>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card id="emails" className="border-border/60 bg-card/50 backdrop-blur-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Emails</CardTitle>
            </div>
            <CardDescription>Sequence order, subject, and body preview.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            {(bundle?.emailSequenceSteps?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No sequence steps yet.</p>
            ) : (
              (bundle?.emailSequenceSteps ?? []).slice(0, 12).map((st) => {
                const tpl = (bundle?.emailTemplates ?? []).find((t) => str(t.id) === str(st.template_id));
                const body = tpl && typeof tpl.body_markdown === "string" ? tpl.body_markdown : "";
                return (
                  <div key={str(st.id)} className="rounded-md border border-border/40 p-2 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">Email {(st.step_index as number) ?? 0}</Badge>
                      <span>delay {String(st.delay_minutes ?? 0)}m</span>
                    </div>
                    <div className="font-medium">{tpl ? str(tpl.subject) : "Template"}</div>
                    {body ? (
                      <pre className="max-h-28 overflow-auto rounded bg-muted/30 p-2 text-[11px] leading-snug whitespace-pre-wrap">
                        {body.slice(0, 1200)}
                        {body.length > 1200 ? "…" : ""}
                      </pre>
                    ) : null}
                  </div>
                );
              })
            )}
            {campaignId ? (
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  View sequence
                </Link>
                <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Edit
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card id="leads" className="border-border/60 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Lead capture</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {(bundle?.leadCaptureForms?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No form yet.</p>
            ) : (
              (bundle?.leadCaptureForms ?? []).slice(0, 3).map((f) => (
                <div key={str(f.id)} className="rounded-md border border-border/40 px-2 py-1.5 space-y-1">
                  <div className="font-medium">{str(f.name)}</div>
                  <div className="text-xs text-muted-foreground">{str(f.status)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card id="analytics" className="border-border/60 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Analytics / tracking</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {(bundle?.analyticsHints?.trackingLinks?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No tracking links yet.</p>
            ) : (
              (bundle?.analyticsHints?.trackingLinks ?? []).slice(0, 6).map((t) => (
                <div key={t.id} className="break-all font-mono text-[11px] text-muted-foreground">
                  {t.label ? `${t.label}: ` : ""}
                  {t.destination_url}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card id="approvals" className="border-border/60 bg-card/50 backdrop-blur-sm lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Approvals</CardTitle>
            </div>
            {pendingCount(bundle) > 0 ? (
              <Badge variant="outline" className="border-amber-500/60">
                {pendingCount(bundle)} pending
              </Badge>
            ) : (
              <Badge variant="secondary">None pending</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {(bundle?.approvals ?? []).length === 0 ? (
              <p className="text-muted-foreground">No approvals for this campaign yet.</p>
            ) : (
              <>
                {anyPending ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {pendingApprovals.length} item{pendingApprovals.length === 1 ? "" : "s"} need approval
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={approveAll.isPending || decide.isPending}
                          onClick={() => approveAll.mutate()}
                        >
                          Approve all
                        </Button>
                        <Link href="/admin/approvals" className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Review
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}

              {(bundle?.approvals ?? []).map((a) => {
                const id = str(a.id);
                const st = str(a.status);
                const pending = st === "pending";
                return (
                  <div key={id} className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{str(a.approval_type)}</Badge>
                      <span className="text-muted-foreground font-mono">{id}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={!pending || decide.isPending || approveAll.isPending}
                        onClick={() => decide.mutate({ approvalId: id, decision: "approved" })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!pending || decide.isPending || approveAll.isPending}
                        onClick={() => {
                          const reason = (rejectReason[id] ?? "").trim();
                          if (!reason) {
                            toast.error("Add a short reject reason");
                            return;
                          }
                          decide.mutate({ approvalId: id, decision: "rejected", reason });
                        }}
                      >
                        Reject
                      </Button>
                      <Link href="/admin/approvals" className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Edit in queue
                      </Link>
                    </div>
                    {pending ? (
                      <Textarea
                        placeholder="Reject reason (required to reject)"
                        value={rejectReason[id] ?? ""}
                        onChange={(e) => setRejectReason((m) => ({ ...m, [id]: e.target.value }))}
                        rows={2}
                        className="text-xs"
                      />
                    ) : null}
                  </div>
                );
              })}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default GeneratedWorkspace;
