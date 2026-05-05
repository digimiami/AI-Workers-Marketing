"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, Brain, GitBranch, ImageIcon, LayoutTemplate, Mail, Megaphone, ShieldCheck, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import type { AiWorkspaceResults } from "@/components/ai/useAiWorkspaceStream";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function fmtTime(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString();
}

function PanelShell(props: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  worker?: string;
  stamp?: string | null;
  glow?: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col border-border/60 bg-card/55 text-left shadow-sm backdrop-blur-sm",
        props.glow && "ring-2 ring-primary/40 shadow-[0_0_28px_-8px_rgba(56,189,248,0.45)]",
      )}
    >
      <CardHeader className="space-y-1 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-1.5 text-primary">{props.icon}</div>
            <div>
              <CardTitle className="text-base leading-tight">{props.title}</CardTitle>
              {props.subtitle ? <CardDescription className="text-xs">{props.subtitle}</CardDescription> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {props.badge ? <Badge variant="secondary">{props.badge}</Badge> : null}
            {props.worker ? (
              <Badge variant="outline" className="font-normal text-[10px] text-muted-foreground">
                {props.worker}
              </Badge>
            ) : null}
          </div>
        </div>
        {props.stamp ? <div className="text-[10px] text-muted-foreground">Updated {props.stamp}</div> : null}
        {props.actions ? <div className="flex flex-wrap gap-2 pt-1">{props.actions}</div> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 pt-0 text-sm">{props.children}</CardContent>
    </Card>
  );
}

function EmptyHint(props: { message: string; campaignId: string | null; section: string }) {
  if (!props.campaignId) return <p className="text-xs text-muted-foreground">{props.message}</p>;
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border/70 bg-muted/10 p-3 text-xs text-muted-foreground">
      <p>{props.message}</p>
      <Link href={`/admin/campaigns/${props.campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        Generate this section in campaign hub
      </Link>
    </div>
  );
}

export function AiWorkspaceAssetDeck(props: {
  results: AiWorkspaceResults;
  campaignId: string | null;
  organizationId: string | null;
  modulePulseAt: Partial<Record<string, number>>;
  className?: string;
  heading?: string;
}) {
  const { results, campaignId, organizationId, modulePulseAt, className, heading = "Generated workspace" } = props;
  const glow = (k: string) => {
    const t = modulePulseAt[k] ?? 0;
    return t > 0 && Date.now() - t < 2800;
  };

  const research = asRecord(results.research);
  const campaign = asRecord(results.campaign);
  const landing = asRecord(results.landing);
  const funnel = asRecord(results.funnel);
  const content = asRecord(results.content);
  const ads = asRecord(results.ads);
  const emails = asRecord(results.emails);
  const lead = asRecord(results.leadCapture);
  const analytics = asRecord(results.analytics);
  const approvals = asRecord(results.approvals);

  const researchHas =
    str(research.offerSummary) ||
    str(research.audience) ||
    (Array.isArray(research.painPoints) && research.painPoints.length) ||
    (Array.isArray(research.hooks) && research.hooks.length) ||
    (Array.isArray(research.buyerObjections) && research.buyerObjections.length);

  const decide = async (approvalId: string, decision: "approved" | "rejected") => {
    if (!organizationId) {
      toast.error("Missing organization");
      return;
    }
    const reason =
      decision === "rejected"
        ? window.prompt("Reason for rejection (required):")?.trim() ?? ""
        : undefined;
    if (decision === "rejected" && !reason) {
      toast.error("Reason required to reject");
      return;
    }
    const res = await fetch(`/api/admin/openclaw/approvals/${approvalId}/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId, decision, reason }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(decision === "approved" ? "Approved" : "Rejected");
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{heading}</h2>
        <span className="text-[11px] text-muted-foreground">Live DB + metadata · same as stream</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <PanelShell
            icon={<Brain className="h-4 w-4" />}
            title="Research"
            badge={researchHas ? "Ready" : "Draft"}
            worker="Pipeline research"
            stamp={fmtTime(str(research.updatedAt))}
            glow={glow("research")}
            actions={
              campaignId ? (
                <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Open campaign
                </Link>
              ) : null
            }
          >
            {researchHas ? (
              <div className="space-y-2 text-xs">
                {str(research.offerSummary) ? (
                  <div>
                    <div className="font-semibold text-[10px] uppercase text-muted-foreground">Offer summary</div>
                    <p className="leading-relaxed text-foreground/90">{str(research.offerSummary)}</p>
                  </div>
                ) : null}
                {str(research.audience) ? (
                  <div>
                    <div className="font-semibold text-[10px] uppercase text-muted-foreground">Audience</div>
                    <p>{str(research.audience)}</p>
                  </div>
                ) : null}
                {Array.isArray(research.painPoints) && research.painPoints.length ? (
                  <div>
                    <div className="font-semibold text-[10px] uppercase text-muted-foreground">Pain points</div>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {(research.painPoints as string[]).slice(0, 6).map((p) => (
                        <li key={p.slice(0, 40)}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {Array.isArray(research.buyerObjections) && research.buyerObjections.length ? (
                  <div>
                    <div className="font-semibold text-[10px] uppercase text-muted-foreground">Objections</div>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {(research.buyerObjections as string[]).slice(0, 5).map((p) => (
                        <li key={p.slice(0, 40)}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {str(research.positioningAngle) || str(research.offerAngle) ? (
                  <div>
                    <div className="font-semibold text-[10px] uppercase text-muted-foreground">Positioning</div>
                    <p>{str(research.positioningAngle) || str(research.offerAngle)}</p>
                  </div>
                ) : null}
                {(() => {
                  const hookList = (research.topHooks ?? research.hooks) as unknown;
                  const hooksArr = Array.isArray(hookList) ? (hookList as string[]) : [];
                  return hooksArr.length ? (
                    <div>
                      <div className="font-semibold text-[10px] uppercase text-muted-foreground">Top hooks</div>
                      <ul className="list-decimal space-y-0.5 pl-4">
                        {hooksArr.slice(0, 6).map((h) => (
                          <li key={h.slice(0, 48)}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
              <EmptyHint
                message="No research payload yet — it will appear after the research stage completes, or from campaign metadata."
                campaignId={campaignId}
                section="research"
              />
            )}
          </PanelShell>
        </motion.div>

        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          <PanelShell
            icon={<Megaphone className="h-4 w-4" />}
            title="Campaign strategy"
            badge={str(campaign.status) || "draft"}
            worker="Campaign planner"
            stamp={fmtTime(str(campaign.updatedAt))}
            glow={glow("campaign")}
            actions={
              campaignId ? (
                <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ size: "sm" })}>
                  Edit strategy
                </Link>
              ) : null
            }
          >
            <div className="space-y-1.5 text-xs">
              <div className="text-base font-semibold text-foreground">{str(campaign.name) || "Campaign"}</div>
              {str(campaign.goal) ? (
                <p>
                  <span className="text-muted-foreground">Goal:</span> {str(campaign.goal)}
                </p>
              ) : null}
              {str(campaign.audience) ? (
                <p>
                  <span className="text-muted-foreground">Audience:</span> {str(campaign.audience)}
                </p>
              ) : null}
              {str(campaign.trafficSource) ? (
                <p>
                  <span className="text-muted-foreground">Traffic:</span> {str(campaign.trafficSource)}
                </p>
              ) : null}
              {str(campaign.offerAngle) ? (
                <p>
                  <span className="text-muted-foreground">Offer angle:</span> {str(campaign.offerAngle)}
                </p>
              ) : null}
              {str(campaign.ctaStrategy) ? (
                <p>
                  <span className="text-muted-foreground">CTA strategy:</span> {str(campaign.ctaStrategy)}
                </p>
              ) : null}
              {str(campaign.description) ? (
                <p className="text-muted-foreground line-clamp-4">{str(campaign.description)}</p>
              ) : null}
            </div>
          </PanelShell>
        </motion.div>

        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.31 }}>
          <PanelShell
            icon={<LayoutTemplate className="h-4 w-4" />}
            title="Landing page"
            badge={str(landing.headline) ? "Copy" : "Pending"}
            worker="Page designer"
            stamp={fmtTime(str(landing.updatedAt))}
            glow={glow("landing")}
            actions={
              campaignId ? (
                <>
                  <Link href={`/f/${campaignId}`} className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-1")}>
                    Preview
                  </Link>
                  <Link href={`/admin/campaigns/${campaignId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Edit
                  </Link>
                </>
              ) : null
            }
          >
            {str(landing.headline) || str(landing.title) ? (
              <div className="space-y-2 text-xs">
                <div className="text-base font-semibold leading-snug">{str(landing.headline) || str(landing.title)}</div>
                {str(landing.subheadline) ? <p className="text-muted-foreground">{str(landing.subheadline)}</p> : null}
                {Array.isArray(landing.bullets) && landing.bullets.length ? (
                  <ul className="list-disc space-y-0.5 pl-4 text-foreground/90">
                    {(landing.bullets as string[]).slice(0, 6).map((b) => (
                      <li key={b.slice(0, 40)}>{b}</li>
                    ))}
                  </ul>
                ) : null}
                {str(landing.leadMagnetTitle) ? (
                  <p>
                    <span className="text-muted-foreground">Lead magnet:</span> {str(landing.leadMagnetTitle)}
                  </p>
                ) : null}
                <p>
                  <span className="text-muted-foreground">CTA:</span>{" "}
                  <span className="font-medium text-primary">{str(landing.primaryCta) || str(landing.cta)}</span>
                </p>
                {str(landing.previewUrl) ? (
                  <p className="break-all font-mono text-[11px] text-muted-foreground">{str(landing.previewUrl)}</p>
                ) : null}
              </div>
            ) : (
              <EmptyHint message="Landing copy not in DB yet." campaignId={campaignId} section="landing" />
            )}
          </PanelShell>
        </motion.div>

        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.34 }}>
          <PanelShell
            icon={<GitBranch className="h-4 w-4" />}
            title="Funnel map"
            badge={`${Array.isArray(funnel.steps) ? funnel.steps.length : 0} steps`}
            worker="Funnel strategist"
            glow={glow("funnel")}
            actions={
              campaignId ? (
                <Link href={`/admin/campaigns/${campaignId}?tab=funnel`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Open funnel
                </Link>
              ) : null
            }
          >
            <div className="flex flex-wrap gap-1 text-[11px]">
              {(Array.isArray(funnel.flow) ? (funnel.flow as string[]) : []).map((label, i, arr) => (
                <span key={`${label}-${i}`} className="flex items-center gap-1">
                  {i ? <span className="text-muted-foreground">→</span> : null}
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-medium">{label}</span>
                  {i === arr.length - 1 ? null : null}
                </span>
              ))}
            </div>
            {Array.isArray(funnel.steps) && funnel.steps.length ? (
              <div className="mt-2 space-y-1.5">
                {(funnel.steps as Array<Record<string, unknown>>).slice(0, 8).map((s) => (
                  <div
                    key={str(s.id)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/15 px-2 py-1.5 text-[11px]"
                  >
                    <div>
                      <div className="font-medium">{str(s.name)}</div>
                      <div className="text-muted-foreground">{str(s.stepType)}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {str(s.status) || "live"}
                    </Badge>
                    {campaignId && str(s.slug) ? (
                      <Link href={`/f/${campaignId}/${str(s.slug)}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        Open
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Provisioned steps appear here once the funnel is created.</p>
            )}
          </PanelShell>
        </motion.div>

        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.37 }}>
          <PanelShell
            icon={<Sparkles className="h-4 w-4" />}
            title="Content"
            badge={`${Array.isArray(content.items) ? content.items.length : 0} assets`}
            worker="Scriptwriter"
            glow={glow("content")}
            actions={
              campaignId ? (
                <Link href={`/admin/campaigns/${campaignId}?tab=content`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  View all content
                </Link>
              ) : null
            }
          >
            {Array.isArray(content.items) && content.items.length ? (
              <div className="space-y-3">
                {(content.items as Array<Record<string, unknown>>).slice(0, 5).map((it) => (
                  <div key={str(it.id)} className="rounded-md border border-border/50 bg-muted/10 p-2 text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-semibold text-foreground">{str(it.title)}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {str(it.platform)}
                      </Badge>
                    </div>
                    {Array.isArray(it.hooks) && (it.hooks as string[]).length ? (
                      <ul className="mt-1 list-disc pl-4">
                        {(it.hooks as string[]).slice(0, 3).map((h) => (
                          <li key={h.slice(0, 32)}>{h}</li>
                        ))}
                      </ul>
                    ) : null}
                    {str(it.scriptExcerpt) ? <pre className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap font-mono text-[10px]">{str(it.scriptExcerpt)}</pre> : null}
                    {str(it.cta) ? (
                      <div className="mt-1 text-primary">
                        CTA: {str(it.cta)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyHint message="No content assets yet." campaignId={campaignId} section="content" />
            )}
          </PanelShell>
        </motion.div>

        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <PanelShell
            icon={<ImageIcon className="h-4 w-4" />}
            title="Ads"
            badge={`${typeof ads.count === "number" ? ads.count : 0} creatives`}
            worker="Ad designer"
            glow={glow("ads")}
            actions={
              campaignId ? (
                <Link href={`/admin/ad-creative`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Ad studio
                </Link>
              ) : null
            }
          >
            {Array.isArray(ads.items) && ads.items.length ? (
              <div className="space-y-2">
                {(ads.items as Array<Record<string, unknown>>).slice(0, 5).map((ad) => (
                  <div key={str(ad.id)} className="rounded-md border border-border/50 bg-muted/10 p-2 text-[11px]">
                    <div className="font-semibold">{str(ad.headline)}</div>
                    <p className="mt-1 text-muted-foreground line-clamp-3">{str(ad.primaryText)}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      <span>{str(ad.platform)}</span>
                      {str(ad.cta) ? <span className="text-primary">CTA: {str(ad.cta)}</span> : null}
                      {str(ad.angle) ? <span>Angle: {str(ad.angle)}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyHint message="No ad_creatives rows — check metadata ad templates or content assets tagged as ads." campaignId={campaignId} section="ads" />
            )}
          </PanelShell>
        </motion.div>

        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.43 }}>
          <PanelShell
            icon={<Mail className="h-4 w-4" />}
            title="Email sequence"
            badge={str(emails.sequenceName) || "Sequence"}
            worker="Email writer"
            glow={glow("emails")}
            actions={
              campaignId ? (
                <Link href={`/admin/campaigns/${campaignId}?tab=emails`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Edit sequence
                </Link>
              ) : null
            }
          >
            {Array.isArray(emails.steps) && emails.steps.length ? (
              <div className="space-y-2">
                {(emails.steps as Array<Record<string, unknown>>).slice(0, 8).map((s, idx) => (
                  <div key={idx} className="rounded-md border border-border/50 bg-muted/10 p-2 text-[11px]">
                    <div className="flex flex-wrap justify-between gap-1">
                      <span className="font-semibold">Email {idx + 1}</span>
                      <span className="text-muted-foreground">Delay {String(s.delayMinutes ?? 0)} min</span>
                    </div>
                    <div className="mt-0.5 font-medium text-foreground">{str(s.subject)}</div>
                    {str(s.bodyPreview) ? <p className="mt-1 line-clamp-3 text-muted-foreground">{str(s.bodyPreview)}</p> : null}
                    {str(s.templateName) ? <div className="text-[10px] text-muted-foreground">Template: {str(s.templateName)}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyHint message="No email steps yet." campaignId={campaignId} section="emails" />
            )}
          </PanelShell>
        </motion.div>

        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.46 }}>
          <PanelShell
            icon={<Users className="h-4 w-4" />}
            title="Lead capture"
            badge={`${Array.isArray(lead.forms) ? lead.forms.length : 0} forms`}
            worker="Lead capture"
            glow={glow("leadCapture")}
          >
            {Array.isArray(lead.forms) && lead.forms.length ? (
              <div className="space-y-2">
                {(lead.forms as Array<Record<string, unknown>>).map((f) => (
                  <div key={str(f.id)} className="rounded-md border border-border/50 bg-muted/10 p-2 text-[11px]">
                    <div className="font-semibold">{str(f.name)}</div>
                    <div className="text-muted-foreground">Status: {str(f.status)}</div>
                    {Array.isArray(f.fields) && f.fields.length ? (
                      <div className="mt-1">Fields: {(f.fields as string[]).join(", ")}</div>
                    ) : null}
                    {str(f.incentive) ? <div className="mt-1">Incentive: {str(f.incentive)}</div> : null}
                    {str(f.cta) ? <div className="mt-1 text-primary">CTA: {str(f.cta)}</div> : null}
                    {str(f.captureUrl) ? (
                      <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{str(f.captureUrl)}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyHint message="No lead capture forms yet." campaignId={campaignId} section="leads" />
            )}
          </PanelShell>
        </motion.div>

        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.49 }}>
          <PanelShell
            icon={<Activity className="h-4 w-4" />}
            title="Analytics & tracking"
            badge={analytics.trackingReady ? "Tracking on" : "Pending"}
            worker="Tracking"
            glow={glow("analytics")}
            actions={
              <Link href="/admin/analytics" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open analytics
              </Link>
            }
          >
            <div className="space-y-1 text-[11px]">
              <p className="font-mono text-[10px] text-muted-foreground">Postback: {str(analytics.postbackRoute)}</p>
              <p className="font-mono text-[10px] text-muted-foreground">Affiliate click: {str(analytics.affiliateClickRoute)}</p>
              {Array.isArray(analytics.links) && analytics.links.length ? (
                <ul className="space-y-1">
                  {(analytics.links as Array<{ id: string; label: string | null; destination_url: string }>).slice(0, 5).map((l) => (
                    <li key={l.id} className="truncate text-muted-foreground">
                      {l.label || "Link"} → {l.destination_url}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Tracking links appear after execution provisions them.</p>
              )}
            </div>
          </PanelShell>
        </motion.div>

        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.52 }}>
          <PanelShell
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Approvals"
            badge={typeof approvals.pendingCount === "number" ? `${approvals.pendingCount} pending` : undefined}
            worker="Gates"
            glow={glow("approvals")}
            actions={
              <Link href="/admin/approvals" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Queue
              </Link>
            }
          >
            {Array.isArray(approvals.items) && approvals.items.length ? (
              <div className="space-y-2">
                {(approvals.items as Array<Record<string, unknown>>).slice(0, 6).map((a) => (
                  <div key={str(a.id)} className="rounded-md border border-border/50 bg-muted/10 p-2 text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px]">{str(a.approval_type)}</span>
                      <Badge variant="outline">{str(a.status)}</Badge>
                    </div>
                    <div className="text-muted-foreground">
                      Target: {str(a.target_entity_type)} {str(a.target_entity_id)}
                    </div>
                    {str(a.payloadSummary) ? <pre className="mt-1 max-h-16 overflow-y-auto font-mono text-[10px]">{str(a.payloadSummary)}</pre> : null}
                    {str(a.risk) ? <div className="text-amber-600/90">Risk: {str(a.risk)}</div> : null}
                    {str(a.status) === "pending" && organizationId ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="default" onClick={() => void decide(str(a.id), "approved")}>
                          Approve
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void decide(str(a.id), "rejected")}>
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No approvals for this campaign.</p>
            )}
          </PanelShell>
        </motion.div>
      </div>
    </div>
  );
}
