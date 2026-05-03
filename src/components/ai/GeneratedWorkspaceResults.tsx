"use client";

import Link from "next/link";
import { ExternalLink, FileText, Funnel, ImageIcon, LayoutTemplate, Mail, MousePointerClick, Radar, Search, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspaceDisplayBundle } from "@/services/workspace/workspaceDisplayBundle";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function pendingApprovals(bundle: WorkspaceDisplayBundle | null) {
  return (bundle?.approvals ?? []).filter((a) => str(a.status) === "pending").length;
}

export function GeneratedWorkspaceResults(props: {
  bundle: WorkspaceDisplayBundle | null;
  organizationId?: string;
  campaignId: string | null;
  pipelineRunId?: string | null;
  className?: string;
}) {
  const { bundle, campaignId, pipelineRunId } = props;
  const c = bundle?.campaign ?? null;
  const research = bundle?.research;

  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", props.className)}>
      <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm lg:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Research</CardTitle>
          </div>
          <CardDescription>Latest pipeline research output for this campaign.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {!research || Object.keys(research).length === 0 ? (
            <p className="text-muted-foreground">No research record yet — it appears when the Research stage completes.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {str(research.offer_summary) ? (
                <div className="rounded-lg border border-border/50 bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Offer summary</div>
                  <div className="mt-1 leading-snug">{str(research.offer_summary)}</div>
                </div>
              ) : null}
              {str((research.icp as Record<string, unknown>)?.audience) || str(research.audience) ? (
                <div className="rounded-lg border border-border/50 bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Audience</div>
                  <div className="mt-1">
                    {str((research.icp as Record<string, unknown>)?.audience) || str(research.audience)}
                  </div>
                </div>
              ) : null}
              {Array.isArray(research.pain_points) && research.pain_points.length ? (
                <div className="rounded-lg border border-border/50 bg-background/50 p-2 sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Pain points</div>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5">
                    {(research.pain_points as string[]).slice(0, 6).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Campaign</CardTitle>
            </div>
            {c ? <Badge variant="outline">{str(c.status) || "draft"}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!campaignId || !c ? (
            <p className="text-muted-foreground">Campaign record appears after strategy is executed.</p>
          ) : (
            <>
              <div className="font-semibold">{str(c.name)}</div>
              <div className="text-xs text-muted-foreground line-clamp-3">{str(c.description) || str(c.target_audience)}</div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "default", size: "sm" })}>
                  Open workspace
                </Link>
                <Link href={`/admin/campaigns/${campaignId}/pipeline`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Pipeline
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Landing</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {(bundle?.landingPages?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No landing page rows yet.</p>
          ) : (
            bundle!.landingPages.slice(0, 2).map((lp) => (
              <div key={str(lp.id)} className="rounded-lg border border-border/50 bg-background/50 p-2 space-y-1">
                <div className="font-medium">{str(lp.display_headline) || str(lp.title)}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{str(lp.display_subheadline) || str(lp.description)}</div>
                {campaignId ? (
                  <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Edit in campaign
                  </Link>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
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
            <Link href={`/f/${campaignId}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}>
              Preview public funnel <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Content</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div>{(bundle?.contentAssets?.length ?? 0)} assets</div>
          {(bundle?.contentAssets ?? []).slice(0, 4).map((a) => (
            <div key={str(a.id)} className="rounded-md border border-border/40 px-2 py-1.5 text-xs">
              <span className="font-medium">{str(a.title)}</span>
              {str(a.platform) ? <span className="text-muted-foreground"> · {str(a.platform)}</span> : null}
            </div>
          ))}
          {campaignId ? (
            <Link href="/admin/content" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open content module
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Ads</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div>{(bundle?.adCreatives?.length ?? 0)} creatives</div>
          <div className="flex flex-wrap gap-1">
            {Array.from(new Set((bundle?.adCreatives ?? []).map((x) => str(x.platform)).filter(Boolean))).map((p) => (
              <Badge key={p} variant="outline">
                {p}
              </Badge>
            ))}
          </div>
          <Link href="/admin/ad-creative" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open ad creative
          </Link>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Emails</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div>{(bundle?.emailTemplates?.length ?? 0)} templates · {(bundle?.emailSequenceSteps?.length ?? 0)} sequence steps</div>
          {(bundle?.emailSequenceSteps ?? []).slice(0, 4).map((st) => {
            const tpl = (bundle?.emailTemplates ?? []).find((t) => str(t.id) === str(st.template_id));
            return (
              <div key={str(st.id)} className="rounded-md border border-border/40 px-2 py-1.5 text-xs">
                <div className="font-medium">Step {(st.step_index as number) ?? 0} · delay {str(st.delay_minutes)}m</div>
                <div className="text-muted-foreground line-clamp-1">{tpl ? str(tpl.subject) : "Template"}</div>
              </div>
            );
          })}
          <Link href="/admin/email" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open email module
          </Link>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
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
            (bundle?.leadCaptureForms ?? []).slice(0, 2).map((f) => (
              <div key={str(f.id)} className="rounded-md border border-border/40 px-2 py-1.5">
                <div className="font-medium">{str(f.name)}</div>
                <div className="text-xs text-muted-foreground">{str(f.status)}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Analytics</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="text-muted-foreground">{(bundle?.analyticsHints?.trackingLinks?.length ?? 0)} tracking links</div>
          {(bundle?.analyticsHints?.trackingLinks ?? []).slice(0, 3).map((t) => (
            <div key={t.id} className="break-all font-mono text-[11px] text-muted-foreground">{t.destination_url}</div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm lg:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Approvals</CardTitle>
            </div>
            {pendingApprovals(bundle) > 0 ? (
              <Badge variant="outline" className="border-amber-500/60">
                {pendingApprovals(bundle)} pending
              </Badge>
            ) : (
              <Badge variant="secondary">None pending</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/admin/approvals" className={buttonVariants({ variant: "default", size: "sm" })}>
            Open approvals
          </Link>
          {pipelineRunId ? (
            <Link href={`/admin/workspace/review/run/${pipelineRunId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Full run summary
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
