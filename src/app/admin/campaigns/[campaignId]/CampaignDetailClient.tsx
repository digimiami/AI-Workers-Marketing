"use client";

import * as React from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import { AiWorkspaceResultsPanel } from "@/components/ai/AiWorkspaceResultsPanel";
import type { AiWorkspaceResults } from "@/components/ai/useAiWorkspaceStream";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { bundleToAiWorkspaceResults } from "@/services/ai/workspaceStreamPayloads";

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
    return (
      <div className="rounded-xl border border-dashed border-primary/25 bg-primary/5 px-4 py-6 text-center text-sm text-muted-foreground animate-pulse">
        AI is generating your funnel steps…
      </div>
    );
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
  const [activeTab, setActiveTab] = React.useState<"overview" | "funnel" | "content" | "emails">("overview");
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  React.useEffect(() => {
    if (urlTab === "funnel" || urlTab === "content" || urlTab === "emails" || urlTab === "overview") {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

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

  const liveWorkspaceResults = React.useMemo((): AiWorkspaceResults => {
    const b = workspaceQuery.data?.workspaceDisplay ?? null;
    return bundleToAiWorkspaceResults(b) as AiWorkspaceResults;
  }, [workspaceQuery.data?.workspaceDisplay]);

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
            <Link className="text-primary underline" href={`/admin/campaigns/${c.id}/pipeline`}>
              Pipeline board
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link
              className="text-primary underline"
              href={`/admin/campaigns/${c.id}/automation`}
            >
              Automation
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link className="text-primary underline" href={`/admin/campaigns/${c.id}?tab=content`}>
              Content
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link className="text-primary underline" href={`/admin/campaigns/${c.id}?tab=emails`}>
              Emails
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
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
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
                        href={`/admin/workspace?${qs.toString()}`}
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

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-[0_0_32px_-12px_rgba(56,189,248,0.25)]">
            <CardHeader>
              <CardTitle className="text-base">AI workspace</CardTitle>
              <CardDescription>Everything this build created — open modules or jump into the live run.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {workspaceQuery.isFetching ? (
                <p className="text-sm text-muted-foreground animate-pulse">Refreshing workspace…</p>
              ) : null}
              {workspaceQuery.data?.workspaceDisplay?.latestPipelineRun?.id ? (
                <Link
                  href={`/admin/workspace/${workspaceQuery.data.workspaceDisplay.latestPipelineRun.id}`}
                  className={buttonVariants({ variant: "default", size: "sm" })}
                >
                  Open live workspace run
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No pipeline run yet — start from{" "}
                  <Link href="/admin/workspace" className="text-primary underline underline-offset-4">
                    Workspace
                  </Link>{" "}
                  to stream a full build.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className="rounded-xl border border-border/60 bg-card/50 p-4 text-left text-sm transition hover:border-primary/40 hover:shadow-[0_0_24px_-8px_rgba(56,189,248,0.35)]"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Campaign</div>
                  <div className="mt-1 font-semibold">Overview &amp; basics</div>
                </button>
                <Link
                  href={`/f/${props.campaignId}`}
                  className="rounded-xl border border-border/60 bg-card/50 p-4 text-left text-sm transition hover:border-primary/40 hover:shadow-[0_0_24px_-8px_rgba(56,189,248,0.35)]"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Landing</div>
                  <div className="mt-1 font-semibold">Live preview</div>
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab("funnel")}
                  className="rounded-xl border border-border/60 bg-card/50 p-4 text-left text-sm transition hover:border-primary/40 hover:shadow-[0_0_24px_-8px_rgba(56,189,248,0.35)]"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Funnel</div>
                  <div className="mt-1 font-semibold">Steps &amp; flow</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("content")}
                  className="rounded-xl border border-border/60 bg-card/50 p-4 text-left text-sm transition hover:border-primary/40 hover:shadow-[0_0_24px_-8px_rgba(56,189,248,0.35)]"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Content</div>
                  <div className="mt-1 font-semibold">Hooks &amp; scripts</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("emails")}
                  className="rounded-xl border border-border/60 bg-card/50 p-4 text-left text-sm transition hover:border-primary/40 hover:shadow-[0_0_24px_-8px_rgba(56,189,248,0.35)]"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Emails</div>
                  <div className="mt-1 font-semibold">Sequences</div>
                </button>
                <Link
                  href="/admin/analytics"
                  className="rounded-xl border border-border/60 bg-card/50 p-4 text-left text-sm transition hover:border-primary/40 hover:shadow-[0_0_24px_-8px_rgba(56,189,248,0.35)]"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Analytics</div>
                  <div className="mt-1 font-semibold">Events</div>
                </Link>
                <Link
                  href="/admin/approvals"
                  className="rounded-xl border border-border/60 bg-card/50 p-4 text-left text-sm transition hover:border-primary/40 hover:shadow-[0_0_24px_-8px_rgba(56,189,248,0.35)]"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approvals</div>
                  <div className="mt-1 font-semibold">Publish queue</div>
                </Link>
              </div>
              <AiWorkspaceResultsPanel results={liveWorkspaceResults} campaignId={props.campaignId} />
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

        <TabsContent value="funnel" className="pt-4 space-y-6">
          {(funnelStepsQuery.data?.steps?.length ?? 0) === 0 ? (
            <Card className="border-dashed border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Funnel in progress</CardTitle>
                <CardDescription>AI is generating steps for this campaign.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/workspace" className={buttonVariants({ variant: "default" })}>
                  Open Workspace to build
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
                <CardTitle className="text-base">Content in progress</CardTitle>
                <CardDescription>AI is generating hooks and scripts for this campaign.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/workspace" className={buttonVariants({ variant: "default" })}>
                  Open Workspace
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

        <TabsContent value="emails" className="pt-4 space-y-6">
          {(workspaceQuery.data?.workspaceDisplay?.emailSequenceSteps?.length ?? 0) === 0 && emailSequence.length === 0 ? (
            <Card className="border-dashed border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Emails in progress</CardTitle>
                <CardDescription>AI is generating your nurture sequence.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/workspace" className={buttonVariants({ variant: "default" })}>
                  Open Workspace
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
                <p className="text-sm text-muted-foreground">AI is generating your sequence steps…</p>
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
      </Tabs>
    </div>
  );
}

