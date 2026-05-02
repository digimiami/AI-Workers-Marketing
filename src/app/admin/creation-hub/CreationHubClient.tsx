"use client";

import * as React from "react";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Campaign = {
  id: string;
  name: string;
  type: string;
  status: string;
  target_audience: string | null;
  description: string | null;
  funnel_count?: number;
  lead_count?: number;
  content_asset_count?: number;
  analytics_event_count?: number;
  created_at: string;
};

type Funnel = {
  id: string;
  name: string;
  status: string;
  campaign_id: string | null;
  campaign_name: string | null;
  step_count: number;
  updated_at: string;
};

type ContentAsset = {
  id: string;
  title: string;
  status: string;
  campaign_id: string | null;
  campaign_name: string | null;
  funnel_name: string | null;
  updated_at: string;
};

type AdGeneration = {
  id: string;
  platform: string;
  tone: string | null;
  goal: string | null;
  status: string;
  campaign_id: string | null;
  created_at: string;
};

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  updated_at: string;
};

type EmailSequence = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  updated_at: string;
};

type DeleteTarget =
  | { type: "campaign"; id: string; name: string }
  | { type: "funnel"; id: string; name: string }
  | { type: "content"; id: string; name: string }
  | { type: "ad"; id: string; name: string }
  | { type: "email-template"; id: string; name: string }
  | { type: "email-sequence"; id: string; name: string };

function readMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function when(value: string) {
  return new Date(value).toLocaleString();
}

function statusTone(status: string) {
  if (["active", "approved", "published", "sent"].includes(status)) return "default";
  if (["failed", "archived", "paused"].includes(status)) return "destructive";
  return "secondary";
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function Row(props: {
  title: string;
  subtitle?: string;
  status?: string;
  meta?: string;
  href?: string;
  testHref?: string;
  onDelete?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 py-3 last:border-0 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-medium">{props.title}</div>
          {props.status ? <Badge variant={statusTone(props.status) as never}>{props.status}</Badge> : null}
        </div>
        {props.subtitle ? <div className="line-clamp-2 text-xs text-muted-foreground">{props.subtitle}</div> : null}
        {props.meta ? <div className="text-xs text-muted-foreground">{props.meta}</div> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {props.href ? (
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={props.href} />}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open
          </Button>
        ) : null}
        {props.testHref ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<a href={props.testHref} target="_blank" rel="noreferrer" />}
          >
              <ExternalLink className="mr-2 h-4 w-4" />
              Test
          </Button>
        ) : null}
        {props.onDelete ? (
          <Button size="sm" variant="destructive" onClick={props.onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SectionCard(props: {
  title: string;
  count?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-base">
          {props.title}
          {typeof props.count === "number" ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">({props.count})</span>
          ) : null}
        </CardTitle>
        {props.action}
      </CardHeader>
      <CardContent>{props.children}</CardContent>
    </Card>
  );
}

export function CreationHubClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [campaignId, setCampaignId] = React.useState<string>("__all__");

  const campaignsQuery = useQuery({
    queryKey: ["hub-campaigns", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/campaigns?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { campaigns: Campaign[] };
      return json.campaigns ?? [];
    },
  });

  const funnelsQuery = useQuery({
    queryKey: ["hub-funnels", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/funnels?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { funnels: Funnel[] };
      return json.funnels ?? [];
    },
  });

  const contentQuery = useQuery({
    queryKey: ["hub-content", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/content-assets?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { assets: ContentAsset[] };
      return json.assets ?? [];
    },
  });

  const adsQuery = useQuery({
    queryKey: ["hub-ads", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ad-creative?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { generations: AdGeneration[] };
      return json.generations ?? [];
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["hub-email-templates", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email/templates?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { templates: EmailTemplate[] };
      return json.templates ?? [];
    },
  });

  const sequencesQuery = useQuery({
    queryKey: ["hub-email-sequences", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email/sequences?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { sequences: EmailSequence[] };
      return json.sequences ?? [];
    },
  });

  const selectedCampaign = campaignId === "__all__"
    ? null
    : (campaignsQuery.data ?? []).find((c) => c.id === campaignId) ?? null;

  const campaigns = campaignsQuery.data ?? [];
  const funnels = (funnelsQuery.data ?? []).filter((f) => campaignId === "__all__" || f.campaign_id === campaignId);
  const content = (contentQuery.data ?? []).filter((a) => campaignId === "__all__" || a.campaign_id === campaignId);
  const ads = (adsQuery.data ?? []).filter((a) => campaignId === "__all__" || a.campaign_id === campaignId);
  const templates = templatesQuery.data ?? [];
  const sequences = sequencesQuery.data ?? [];

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["hub-campaigns", organizationId] }),
      qc.invalidateQueries({ queryKey: ["hub-funnels", organizationId] }),
      qc.invalidateQueries({ queryKey: ["hub-content", organizationId] }),
      qc.invalidateQueries({ queryKey: ["hub-ads", organizationId] }),
      qc.invalidateQueries({ queryKey: ["hub-email-templates", organizationId] }),
      qc.invalidateQueries({ queryKey: ["hub-email-sequences", organizationId] }),
    ]);
  };

  const deleteMutation = useMutation({
    mutationFn: async (target: DeleteTarget) => {
      const endpoint = {
        campaign: `/api/admin/campaigns/${target.id}`,
        funnel: `/api/admin/funnels/${target.id}`,
        content: `/api/admin/content-assets/${target.id}`,
        ad: `/api/admin/ad-creative/${target.id}`,
        "email-template": `/api/admin/email/templates/${target.id}`,
        "email-sequence": `/api/admin/email/sequences/${target.id}`,
      }[target.type];

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return target;
    },
    onSuccess: async (target) => {
      toast.success(`${target.name} deleted`);
      await refreshAll();
    },
    onError: (e) => toast.error(readMessage(e, "Delete failed")),
  });

  const askDelete = (target: DeleteTarget) => {
    const ok = window.confirm(`Delete "${target.name}"? This cannot be undone.`);
    if (!ok) return;
    deleteMutation.mutate(target);
  };

  const loading =
    campaignsQuery.isLoading ||
    funnelsQuery.isLoading ||
    contentQuery.isLoading ||
    adsQuery.isLoading ||
    templatesQuery.isLoading ||
    sequencesQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Creation Hub</h1>
          <p className="text-sm text-muted-foreground">
            One place to see what exists, open it, test the public flow, and delete what you do not want.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Select value={campaignId} onValueChange={(value) => setCampaignId(value ?? "__all__")}>
            <SelectTrigger className="md:w-[280px]">
              <SelectValue placeholder="Filter campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All campaigns</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void refreshAll()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Campaigns</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{campaigns.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Funnels</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{funnels.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Content + Ads</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{content.length + ads.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Email</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{templates.length + sequences.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Test links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" nativeButton={false} render={<a href="/demo" target="_blank" rel="noreferrer" />}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Demo
          </Button>
          <Button size="sm" variant="outline" nativeButton={false} render={<a href="/book" target="_blank" rel="noreferrer" />}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Booking
          </Button>
          {selectedCampaign ? (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<a href={`/f/${selectedCampaign.id}`} target="_blank" rel="noreferrer" />}
            >
                <ExternalLink className="mr-2 h-4 w-4" />
                Public funnel
            </Button>
          ) : null}
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/admin/ai-command" />}>
            Create with AI
          </Button>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/admin/launch" />}>
            Autopilot Launch
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="campaigns">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="campaigns">Campaign</TabsTrigger>
          <TabsTrigger value="landing">Landing</TabsTrigger>
          <TabsTrigger value="funnels">Funnel</TabsTrigger>
          <TabsTrigger value="contest">Contest</TabsTrigger>
          <TabsTrigger value="ads">Ads</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="pt-4">
          <SectionCard title="Campaigns" count={campaigns.length} action={<Button size="sm" nativeButton={false} render={<Link href="/admin/campaigns" />}>Create</Button>}>
            {campaigns.length === 0 ? <EmptyRow text="No campaigns yet." /> : campaigns.map((c) => (
              <Row
                key={c.id}
                title={c.name}
                subtitle={c.description ?? c.target_audience ?? undefined}
                status={c.status}
                meta={`${c.type} · funnels ${c.funnel_count ?? 0} · leads ${c.lead_count ?? 0} · content ${c.content_asset_count ?? 0}`}
                href={`/admin/campaigns/${c.id}`}
                testHref={`/f/${c.id}`}
                onDelete={() => askDelete({ type: "campaign", id: c.id, name: c.name })}
              />
            ))}
          </SectionCard>
        </TabsContent>

        <TabsContent value="landing" className="pt-4">
          <SectionCard title="Landing pages" count={campaigns.length}>
            {(campaignId === "__all__" ? campaigns : campaigns.filter((c) => c.id === campaignId)).map((c) => (
              <Row
                key={c.id}
                title={`${c.name} landing`}
                subtitle="Public campaign entry page generated from campaign and funnel settings."
                status={c.status}
                href={`/admin/campaigns/${c.id}`}
                testHref={`/f/${c.id}`}
              />
            ))}
            {campaigns.length === 0 ? <EmptyRow text="No landing pages yet. Create a campaign or run Autopilot Launch first." /> : null}
          </SectionCard>
        </TabsContent>

        <TabsContent value="funnels" className="pt-4">
          <SectionCard title="Funnels" count={funnels.length} action={<Button size="sm" nativeButton={false} render={<Link href="/admin/funnels" />}>Create</Button>}>
            {funnels.length === 0 ? <EmptyRow text="No funnels for this filter." /> : funnels.map((f) => (
              <Row
                key={f.id}
                title={f.name}
                subtitle={f.campaign_name ?? "No campaign linked"}
                status={f.status}
                meta={`${f.step_count} steps · updated ${when(f.updated_at)}`}
                href="/admin/funnels"
                testHref={f.campaign_id ? `/f/${f.campaign_id}` : undefined}
                onDelete={() => askDelete({ type: "funnel", id: f.id, name: f.name })}
              />
            ))}
          </SectionCard>
        </TabsContent>

        <TabsContent value="contest" className="pt-4">
          <SectionCard title="Contests">
            <EmptyRow text="Contest is not a separate saved object yet. Use a campaign + landing + lead capture for now; this hub is ready for a real Contest module when we add it." />
          </SectionCard>
        </TabsContent>

        <TabsContent value="ads" className="pt-4">
          <SectionCard title="Ad generations" count={ads.length} action={<Button size="sm" nativeButton={false} render={<Link href="/admin/ad-creative" />}>Open ads</Button>}>
            {ads.length === 0 ? <EmptyRow text="No ad generations for this filter." /> : ads.map((a) => (
              <Row
                key={a.id}
                title={`${a.platform} ad`}
                subtitle={a.goal ?? a.tone ?? undefined}
                status={a.status}
                meta={when(a.created_at)}
                href="/admin/ad-creative"
                onDelete={() => askDelete({ type: "ad", id: a.id, name: `${a.platform} ad` })}
              />
            ))}
          </SectionCard>
        </TabsContent>

        <TabsContent value="email" className="pt-4 space-y-4">
          <SectionCard title="Email sequences" count={sequences.length} action={<Button size="sm" nativeButton={false} render={<Link href="/admin/email" />}>Create</Button>}>
            {sequences.length === 0 ? <EmptyRow text="No email sequences yet." /> : sequences.map((s) => (
              <Row
                key={s.id}
                title={s.name}
                subtitle={s.description ?? undefined}
                status={s.is_active ? "active" : "paused"}
                meta={`updated ${when(s.updated_at)}`}
                href="/admin/email"
                onDelete={() => askDelete({ type: "email-sequence", id: s.id, name: s.name })}
              />
            ))}
          </SectionCard>
          <SectionCard title="Email templates" count={templates.length}>
            {templates.length === 0 ? <EmptyRow text="No email templates yet." /> : templates.map((t) => (
              <Row
                key={t.id}
                title={t.name}
                subtitle={t.subject}
                meta={`updated ${when(t.updated_at)}`}
                href="/admin/email"
                onDelete={() => askDelete({ type: "email-template", id: t.id, name: t.name })}
              />
            ))}
          </SectionCard>
        </TabsContent>

        <TabsContent value="content" className="pt-4">
          <SectionCard title="Content assets" count={content.length} action={<Button size="sm" nativeButton={false} render={<Link href="/admin/content" />}>Create</Button>}>
            {content.length === 0 ? <EmptyRow text="No content assets for this filter." /> : content.map((a) => (
              <Row
                key={a.id}
                title={a.title}
                subtitle={[a.campaign_name, a.funnel_name].filter(Boolean).join(" · ") || undefined}
                status={a.status}
                meta={`updated ${when(a.updated_at)}`}
                href="/admin/content"
                onDelete={() => askDelete({ type: "content", id: a.id, name: a.title })}
              />
            ))}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
