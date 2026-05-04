"use client";

import * as React from "react";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import { GeneratedWorkspaceResults } from "@/components/ai/GeneratedWorkspaceResults";
import { PipelineStepper } from "@/components/ai/PipelineStepper";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const CampaignType = z.enum(["affiliate", "lead_gen", "internal_test", "client"]);
const CampaignStatus = z.enum(["draft", "active", "paused", "completed"]);

type CampaignRow = {
  id: string;
  organization_id: string;
  name: string;
  type: z.infer<typeof CampaignType>;
  status: z.infer<typeof CampaignStatus>;
  target_audience: string | null;
  description: string | null;
  funnel_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type AdTemplate = {
  ad_name: string;
  platform: string;
  type: string;
  hooks: string;
  cta: string;
  target_audience: string;
};

type EmailStep = { day: number; subject: string; template: string };

type LeadCapture = {
  form_fields: string[];
  incentive: string;
  autoresponder: string;
};

type LandingSettings = {
  landing_url: string;
  cta_button_text: string;
  meta_title: string;
  meta_description: string;
};

type FunnelStepRow = {
  id: string;
  step_index: number;
  name: string;
  step_type: string;
  slug: string;
};

function FunnelFlow({ steps }: { steps: FunnelStepRow[] }) {
  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground">No funnel steps found for this campaign yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-3">
        {steps.map((s, idx) => (
          <React.Fragment key={s.id}>
            <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-3">
              <div className="text-xs text-muted-foreground">Step {idx + 1}</div>
              <div className="font-medium">{s.name}</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">{s.step_type}</div>
            </div>
            {idx < steps.length - 1 ? (
              <div className="text-muted-foreground">→</div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function readCampaignSections(metadata: Record<string, unknown>) {
  // Backward-compatible metadata reader:
  // - Legacy flat shape: metadata.ad_templates, metadata.email_sequence, metadata.funnel_settings, ...
  // - New strict OpenClaw shape: metadata.ads, metadata.emails, metadata.funnel (containers)
  const adsMeta = asRecord(metadata.ads);
  const emailsMeta = asRecord(metadata.emails);
  const funnelMeta = asRecord(metadata.funnel);

  const adRows = (() => {
    const a = asArray<Record<string, unknown>>(adsMeta.ad_templates);
    if (a.length) return a;
    const b = asArray<Record<string, unknown>>(adsMeta.templates);
    if (b.length) return b;
    return asArray<Record<string, unknown>>(metadata.ad_templates);
  })();

  const ads = adRows.map(
    (a): AdTemplate => ({
      ad_name: asString(a.ad_name),
      platform: asString(a.platform),
      type: asString(a.type),
      hooks: asString(a.hooks),
      cta: asString(a.cta),
      target_audience: asString(a.target_audience),
    }),
  );

  const contentHooksScripts = asRecord(adsMeta.content_hooks_scripts ?? metadata.content_hooks_scripts) as {
    hooks?: unknown;
    scripts?: unknown;
  };

  const emailRows = (() => {
    const a = asArray<Record<string, unknown>>(emailsMeta.email_sequence);
    if (a.length) return a;
    const b = asArray<Record<string, unknown>>(emailsMeta.sequence);
    if (b.length) return b;
    return asArray<Record<string, unknown>>(metadata.email_sequence);
  })();

  const email = emailRows.map(
    (e): EmailStep => ({
      day: asNumber(e.day),
      subject: asString(e.subject),
      template: asString(e.template),
    }),
  );

  const lead = asRecord(metadata.lead_capture_settings);
  const leadCapture: LeadCapture = {
    form_fields: asArray<string>(lead.form_fields).filter((s) => typeof s === "string"),
    incentive: asString(lead.incentive),
    autoresponder: asString(lead.autoresponder),
  };

  const landing = asRecord(metadata.landing_settings);
  const landingSettings: LandingSettings = {
    landing_url: asString(landing.landing_url),
    cta_button_text: asString(landing.cta_button_text),
    meta_title: asString(landing.meta_title),
    meta_description: asString(landing.meta_description),
  };

  const funnel = asRecord(funnelMeta.funnel_settings ?? metadata.funnel_settings);

  return {
    adTemplates: ads,
    contentHooks: asArray<string>(contentHooksScripts?.hooks).filter((s) => typeof s === "string"),
    contentScripts: asArray<string>(contentHooksScripts?.scripts).filter((s) => typeof s === "string"),
    emailSequence: email,
    leadCapture,
    landingSettings,
    funnelType: asString(funnel.funnel_type),
  };
}

export function CampaignDetailClient(props: { organizationId: string; campaignId: string }) {
  const qc = useQueryClient();

  const campaignQuery = useQuery({
    queryKey: ["campaign", props.organizationId, props.campaignId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/campaigns/${props.campaignId}?organizationId=${props.organizationId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; campaign: CampaignRow };
      return j.campaign;
    },
  });

  const [draftName, setDraftName] = React.useState("");
  const [draftAudience, setDraftAudience] = React.useState("");
  const [draftDesc, setDraftDesc] = React.useState("");

  const [adTemplates, setAdTemplates] = React.useState<AdTemplate[]>([]);
  const [hooksText, setHooksText] = React.useState("");
  const [scriptsText, setScriptsText] = React.useState("");
  const [emailSequence, setEmailSequence] = React.useState<EmailStep[]>([]);
  const [askText, setAskText] = React.useState("");
  const [leadCapture, setLeadCapture] = React.useState<LeadCapture>({
    form_fields: ["email", "full_name"],
    incentive: "",
    autoresponder: "",
  });
  const [landingSettings, setLandingSettings] = React.useState<LandingSettings>({
    landing_url: "",
    cta_button_text: "",
    meta_title: "",
    meta_description: "",
  });
  const [funnelType, setFunnelType] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<
    | "overview"
    | "pipeline"
    | "research"
    | "landing"
    | "funnel"
    | "content"
    | "ads"
    | "emails"
    | "leads"
    | "analytics"
    | "approvals"
    | "logs"
  >("overview");

  const workspaceQuery = useQuery({
    queryKey: ["workspace-api", props.organizationId, props.campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${props.campaignId}?organizationId=${props.organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as {
        ok: boolean;
        workspaceDisplay?: import("@/services/workspace/workspaceDisplayBundle").WorkspaceDisplayBundle;
        logs?: Array<{ id: string; level: string; message: string; created_at: string }>;
        approvals?: Array<{ id: string; approval_type: string; status: string; created_at: string }>;
      };
    },
  });

  const funnelStepsQuery = useQuery({
    queryKey: ["campaign-funnel-steps", props.organizationId, props.campaignId, campaignQuery.data?.funnel_id],
    enabled: Boolean(campaignQuery.data),
    queryFn: async () => {
      const c = campaignQuery.data;
      if (!c) return { steps: [] as FunnelStepRow[], funnelId: null as string | null };
      // Prefer explicit campaign.funnel_id; fall back to the first funnel linked to campaign_id.
      let funnelId = (c as any).funnel_id as string | null | undefined;
      if (!funnelId) {
        const resFunnels = await fetch(`/api/admin/funnels?organizationId=${props.organizationId}`);
        if (!resFunnels.ok) throw new Error(await resFunnels.text());
        const jf = (await resFunnels.json()) as { ok: boolean; funnels: Array<{ id: string; campaign_id: string | null }> };
        const match = (jf.funnels ?? []).find((f) => f.campaign_id === props.campaignId);
        funnelId = match?.id ?? null;
      }
      if (!funnelId) return { steps: [] as FunnelStepRow[], funnelId: null };
      const res = await fetch(`/api/admin/funnels/${funnelId}/steps?organizationId=${props.organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; steps: FunnelStepRow[] };
      return { steps: j.steps ?? [], funnelId };
    },
  });

  React.useEffect(() => {
    const c = campaignQuery.data;
    if (!c) return;
    setDraftName(c.name);
    setDraftAudience(c.target_audience ?? "");
    setDraftDesc(c.description ?? "");
    const sections = readCampaignSections(c.metadata ?? {});
    setAdTemplates(sections.adTemplates);
    setHooksText(sections.contentHooks.join("\n"));
    setScriptsText(sections.contentScripts.join("\n\n---\n\n"));
    setEmailSequence(sections.emailSequence);
    setLeadCapture(sections.leadCapture);
    setLandingSettings(sections.landingSettings);
    setFunnelType(sections.funnelType);
  }, [campaignQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const c = campaignQuery.data;
      if (!c) throw new Error("Campaign not loaded");

      const metadataPatch = {
        ad_templates: adTemplates,
        landing_settings: landingSettings,
        funnel_settings: { funnel_type: funnelType },
        content_hooks_scripts: {
          hooks: hooksText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          scripts: scriptsText
            .split("\n\n---\n\n")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        email_sequence: emailSequence,
        lead_capture_settings: leadCapture,
      };

      const res = await fetch(`/api/admin/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: props.organizationId,
          name: draftName,
          targetAudience: draftAudience || null,
          description: draftDesc || null,
          metadata: metadataPatch,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; campaign?: CampaignRow };
      return j.campaign ?? null;
    },
    onSuccess: async (updated) => {
      toast.success("Campaign saved");
      if (updated) {
        qc.setQueryData(["campaign", props.organizationId, props.campaignId], updated);
      }
      await qc.invalidateQueries({ queryKey: ["campaign", props.organizationId, props.campaignId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const c = campaignQuery.data;
  if (campaignQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading campaign…</p>;
  if (!c) return <p className="text-sm text-muted-foreground">Campaign not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <Badge variant="outline">{c.status}</Badge>
            <Badge variant="secondary" className="font-normal">
              Goal: {c.description?.slice(0, 48) || c.target_audience?.slice(0, 48) || "—"}
              {(c.description?.length ?? 0) > 48 ? "…" : ""}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-xs">{c.id}</span>
            {c.target_audience ? (
              <>
                {" "}
                · Audience: <span className="text-foreground/90">{c.target_audience}</span>
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link className="text-primary underline" href={`/admin/workspace/review/${c.id}`}>
              Results
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link
              className="text-primary underline"
              href={`/admin/campaigns/${c.id}/pipeline`}
            >
              Pipeline
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link
              className="text-primary underline"
              href={`/admin/campaigns/${c.id}/automation`}
            >
              Automation
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link className="text-primary underline" href="/admin/content">
              Content
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link className="text-primary underline" href="/admin/email">
              Email
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link className="text-primary underline" href="/admin/leads">
              Leads
            </Link>
          </div>
        </div>
        <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Save
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList variant="line" className="w-full flex-wrap justify-start gap-1 h-auto py-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="landing">Landing</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="ads">Ads</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4 space-y-6">
          <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">🤖 Ask AiWorkers</CardTitle>
              <CardDescription>Ask for changes. We’ll route you to the right AI run.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const prompt = askText.trim();
                const qs = new URLSearchParams();
                qs.set("campaignId", props.campaignId);
                if (prompt) qs.set("prompt", prompt);
                return (
                  <>
                    <Input
                      value={askText}
                      onChange={(e) => setAskText(e.target.value)}
                      placeholder="Improve this funnel…"
                      className="h-11"
                    />
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Improve this funnel",
                        "Generate 10 new hooks",
                        "Fix landing page",
                        "Analyze campaign",
                      ].map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => setAskText(ex)}
                          className="rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/ai-command?${qs.toString()}`}
                        className={buttonVariants({ variant: "default" })}
                      >
                        Ask AiWorkers
                      </Link>
                      <Button type="button" variant="outline" onClick={() => setAskText("")}>
                        Clear
                      </Button>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="text-base">Workspace snapshot</CardTitle>
              <CardDescription>Live records created for this campaign (from the database).</CardDescription>
            </CardHeader>
            <CardContent>
              <GeneratedWorkspaceResults
                bundle={workspaceQuery.data?.workspaceDisplay ?? null}
                organizationId={props.organizationId}
                campaignId={props.campaignId}
                pipelineRunId={workspaceQuery.data?.workspaceDisplay?.latestPipelineRun?.id ?? null}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basics</CardTitle>
              <CardDescription>Name, audience, and description.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience">Target audience</Label>
                <Input
                  id="audience"
                  value={draftAudience}
                  onChange={(e) => setDraftAudience(e.target.value)}
                  placeholder="Busy founders, agency owners, etc."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  rows={4}
                  placeholder="What this campaign is for..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="pt-4 space-y-6">
          {(() => {
            const bundle = workspaceQuery.data?.workspaceDisplay ?? null;
            const latest = bundle?.latestPipelineRun ?? null;
            const pendingApprovals = (bundle?.approvals ?? []).filter((a) => asString(asRecord(a).status) === "pending");
            const needsApproval =
              pendingApprovals.length > 0 ||
              asString(latest?.status) === "needs_approval" ||
              asString(latest?.current_stage) === "execution";

            const researchDone = Boolean(bundle?.research && Object.keys(bundle.research).length > 0);
            const strategyDone = Boolean(bundle?.campaign);
            const creationDone = Boolean(
              (bundle?.landingPages?.length ?? 0) > 0 ||
                (bundle?.funnelSteps?.length ?? 0) > 0 ||
                (bundle?.contentAssets?.length ?? 0) > 0 ||
                (bundle?.emailSequenceSteps?.length ?? 0) > 0,
            );
            const executionDone = asString(latest?.status) === "complete" || asString(latest?.status) === "completed";

            const goal =
              asString(asRecord((campaignQuery.data as any)?.metadata).goal) ||
              asString(asRecord((campaignQuery.data as any)?.metadata).objective);

            return (
              <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{campaignQuery.data?.name ?? "Campaign"}</CardTitle>
                      <CardDescription>
                        <span className="font-mono">{asString(campaignQuery.data?.status)}</span>
                        {goal ? <span className="text-muted-foreground"> · </span> : null}
                        {goal ? <span>Goal: {goal}</span> : null}
                      </CardDescription>
                    </div>
                    {needsApproval ? (
                      <Badge variant="outline" className="border-amber-500/60">
                        Execution pending approval
                      </Badge>
                    ) : executionDone ? (
                      <Badge variant="secondary">Execution complete</Badge>
                    ) : (
                      <Badge variant="outline">In progress</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline</div>
                    <PipelineStepper
                      compact
                      stages={[
                        { key: "research", status: researchDone ? "completed" : "pending", summary: "Research" },
                        { key: "strategy", status: strategyDone ? "completed" : "pending", summary: "Strategy" },
                        { key: "creation", status: creationDone ? "completed" : "pending", summary: "Creation" },
                        {
                          key: "execution",
                          status: needsApproval ? "needs_approval" : executionDone ? "completed" : "pending",
                          summary: "Execution",
                        },
                      ]}
                    />
                  </div>

                  {needsApproval ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                      <div className="text-sm font-medium">Next action</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Approve landing page + emails to launch.
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" onClick={() => setActiveTab("approvals")}>
                          Review &amp; Approve
                        </Button>
                        <Link href="/admin/approvals" className={buttonVariants({ variant: "outline", size: "default" })}>
                          Open approvals queue
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })()}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline board</CardTitle>
              <CardDescription>Research → Strategy → Creation → Execution → Optimization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <FunnelFlow steps={funnelStepsQuery.data?.steps ?? []} />
              <Link className={buttonVariants({ variant: "default", size: "sm" })} href={`/admin/campaigns/${c.id}/pipeline`}>
                Open full pipeline
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="research" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Research outputs</CardTitle>
              <CardDescription>From the latest marketing pipeline run.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {workspaceQuery.data?.workspaceDisplay?.research &&
              Object.keys(workspaceQuery.data.workspaceDisplay.research).length > 0 ? (
                <pre className="max-h-[420px] overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                  {JSON.stringify(workspaceQuery.data.workspaceDisplay.research, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">No research payload yet. Run AI Command → Build workspace for this URL.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="landing" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Landing Page</CardTitle>
              <CardDescription>Landing URL, CTA button text, and meta title/description (stored in metadata).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Landing URL</Label>
                <Input
                  value={landingSettings.landing_url}
                  onChange={(e) => setLandingSettings((s) => ({ ...s, landing_url: e.target.value }))}
                  placeholder="https://dulcediaz.com"
                />
              </div>
              <div className="space-y-2">
                <Label>CTA button text</Label>
                <Input
                  value={landingSettings.cta_button_text}
                  onChange={(e) => setLandingSettings((s) => ({ ...s, cta_button_text: e.target.value }))}
                  placeholder="Get your free report"
                />
              </div>
              <div className="space-y-2">
                <Label>Meta title</Label>
                <Input
                  value={landingSettings.meta_title}
                  onChange={(e) => setLandingSettings((s) => ({ ...s, meta_title: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Meta description</Label>
                <Textarea
                  value={landingSettings.meta_description}
                  onChange={(e) => setLandingSettings((s) => ({ ...s, meta_description: e.target.value }))}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="pt-4 space-y-6">
          {(funnelStepsQuery.data?.steps?.length ?? 0) === 0 ? (
            <Card className="border-dashed border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">No funnel yet</CardTitle>
                <CardDescription>Build landing → bridge → capture from AI Command.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/ai-command" className={buttonVariants({ variant: "default" })}>
                  Build funnel
                </Link>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funnel</CardTitle>
              <CardDescription>
                Funnel type + steps (steps are loaded from the funnel tables when available).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-md">
                <Label>Funnel type</Label>
                <Input
                  value={funnelType}
                  onChange={(e) => setFunnelType(e.target.value)}
                  placeholder="3-page squeeze"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Steps</div>
                <FunnelFlow steps={funnelStepsQuery.data?.steps ?? []} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="pt-4 space-y-6">
          {(workspaceQuery.data?.workspaceDisplay?.contentAssets?.length ?? 0) === 0 &&
          !hooksText.trim() &&
          !scriptsText.trim() ? (
            <Card className="border-dashed border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">No content yet</CardTitle>
                <CardDescription>Generate hooks and scripts from this campaign with AI Command.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/ai-command" className={buttonVariants({ variant: "default" })}>
                  Ask AI to generate content
                </Link>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content hooks & scripts</CardTitle>
              <CardDescription>Hooks and scripts stored in metadata.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Hooks (one per line)</Label>
                <Textarea value={hooksText} onChange={(e) => setHooksText(e.target.value)} rows={10} />
              </div>
              <div className="space-y-2">
                <Label>Scripts (separate with blank line + ---)</Label>
                <Textarea
                  value={scriptsText}
                  onChange={(e) => setScriptsText(e.target.value)}
                  rows={10}
                  placeholder={"Hook + CTA...\n\n---\n\nSocial proof format..."}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ads" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ad templates</CardTitle>
              <CardDescription>Each with name, platform, type, hooks, CTA, target.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {adTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ad templates yet.</p>
              ) : null}
              <div className="space-y-3">
                {adTemplates.map((a, idx) => (
                  <div key={idx} className="rounded-lg border border-border/60 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">Ad #{idx + 1}</div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAdTemplates((rows) => rows.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Ad name</Label>
                        <Input
                          value={a.ad_name}
                          onChange={(e) =>
                            setAdTemplates((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, ad_name: e.target.value } : r)),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Platform</Label>
                        <Input
                          value={a.platform}
                          onChange={(e) =>
                            setAdTemplates((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, platform: e.target.value } : r)),
                            )
                          }
                          placeholder="facebook"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Type</Label>
                        <Input
                          value={a.type}
                          onChange={(e) =>
                            setAdTemplates((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, type: e.target.value } : r)),
                            )
                          }
                          placeholder="image / video / carousel"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>CTA</Label>
                        <Input
                          value={a.cta}
                          onChange={(e) =>
                            setAdTemplates((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, cta: e.target.value } : r)),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>Target audience</Label>
                        <Input
                          value={a.target_audience}
                          onChange={(e) =>
                            setAdTemplates((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, target_audience: e.target.value } : r)),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>Hooks</Label>
                        <Textarea
                          value={a.hooks}
                          onChange={(e) =>
                            setAdTemplates((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, hooks: e.target.value } : r)),
                            )
                          }
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setAdTemplates((rows) => [
                    ...rows,
                    { ad_name: "", platform: "facebook", type: "image", hooks: "", cta: "", target_audience: draftAudience },
                  ])
                }
              >
                Add ad template
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails" className="pt-4 space-y-6">
          {(workspaceQuery.data?.workspaceDisplay?.emailSequenceSteps?.length ?? 0) === 0 && emailSequence.length === 0 ? (
            <Card className="border-dashed border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">No nurture sequence yet</CardTitle>
                <CardDescription>Ask AI to draft a short sequence tied to this campaign.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/ai-command" className={buttonVariants({ variant: "default" })}>
                  Create sequence
                </Link>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email sequence</CardTitle>
              <CardDescription>Day, subject, template label (stored in metadata).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {emailSequence.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sequence defined yet.</p>
              ) : null}
              <div className="space-y-2">
                {emailSequence.map((s, idx) => (
                  <div key={idx} className="grid gap-2 rounded-lg border border-border/60 p-3 md:grid-cols-12">
                    <div className="md:col-span-2 space-y-1">
                      <Label>Day</Label>
                      <Input
                        value={String(s.day)}
                        onChange={(e) =>
                          setEmailSequence((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, day: Number(e.target.value || "0") } : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="md:col-span-5 space-y-1">
                      <Label>Subject</Label>
                      <Input
                        value={s.subject}
                        onChange={(e) =>
                          setEmailSequence((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, subject: e.target.value } : r)),
                          )
                        }
                      />
                    </div>
                    <div className="md:col-span-4 space-y-1">
                      <Label>Template</Label>
                      <Input
                        value={s.template}
                        onChange={(e) =>
                          setEmailSequence((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, template: e.target.value } : r)),
                          )
                        }
                      />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEmailSequence((rows) => rows.filter((_, i) => i !== idx))}
                      >
                        X
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmailSequence((rows) => [...rows, { day: rows.length + 1, subject: "", template: "" }])}
              >
                Add email step
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tracking</CardTitle>
              <CardDescription>Affiliate / campaign tracking links.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(workspaceQuery.data?.workspaceDisplay?.affiliateLinks?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">No tracking links yet.</p>
              ) : (
                (workspaceQuery.data?.workspaceDisplay?.affiliateLinks ?? []).map((l) => (
                  <div key={String(l.id)} className="rounded-lg border border-border/60 p-2 font-mono text-xs break-all">
                    {String(l.destination_url ?? "")}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approvals</CardTitle>
              <CardDescription>Gated actions for this campaign.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(workspaceQuery.data?.approvals?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">No approvals yet.</p>
              ) : (
                (workspaceQuery.data?.approvals ?? []).slice(0, 30).map((a) => (
                  <div key={String(a.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-2 py-1.5">
                    <span className="font-mono text-xs">{String(a.approval_type)}</span>
                    <Badge variant="outline">{String(a.status)}</Badge>
                  </div>
                ))
              )}
              <Link href="/admin/approvals" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open approvals queue
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent AI activity</CardTitle>
              <CardDescription>Latest agent logs for your organization (not strictly filtered to this campaign).</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[480px] overflow-auto rounded-lg border border-border/60 bg-muted/20 p-2 font-mono text-[11px] space-y-1">
              {(workspaceQuery.data?.logs ?? []).slice(0, 80).map((l) => (
                <div key={String(l.id)}>
                  <span className="text-muted-foreground">{String(l.created_at ?? "").slice(0, 19)}</span>{" "}
                  <span className={l.level === "error" ? "text-destructive" : ""}>{String(l.message ?? "")}</span>
                </div>
              ))}
              {(workspaceQuery.data?.logs?.length ?? 0) === 0 ? <p className="text-muted-foreground font-sans text-sm">No logs.</p> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead capture settings</CardTitle>
              <CardDescription>Form fields, incentive, autoresponder (stored in metadata).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Form fields (comma-separated)</Label>
                <Input
                  value={leadCapture.form_fields.join(", ")}
                  onChange={(e) =>
                    setLeadCapture((s) => ({
                      ...s,
                      form_fields: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="email, full_name"
                />
              </div>
              <div className="space-y-2">
                <Label>Incentive</Label>
                <Input
                  value={leadCapture.incentive}
                  onChange={(e) => setLeadCapture((s) => ({ ...s, incentive: e.target.value }))}
                  placeholder="Free home value report"
                />
              </div>
              <div className="space-y-2">
                <Label>Autoresponder</Label>
                <Textarea
                  value={leadCapture.autoresponder}
                  onChange={(e) => setLeadCapture((s) => ({ ...s, autoresponder: e.target.value }))}
                  rows={4}
                  placeholder="Thanks for requesting... (draft)"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

