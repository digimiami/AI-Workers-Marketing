"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type OrgRow = { id: string; name: string; slug: string; role: string };

type RunContext = { runId: string; traceId: string; organizationId: string };

type ReviewModel = {
  kind?: string;
  mode?: string;
  approvals: Record<string, boolean>;
  organization?: { id: string };
  lead_system?: { settings_key: string; summary: string };
  workers?: { assigned: Array<{ agent_key: string; id?: string }> };
  child_runs?: Array<{ id: string; agent_key: string }>;
  approval_items?: Array<{ id: string; approval_type: string }>;
  analytics?: { baseline_logged?: boolean; event?: string };
  settings_keys_initialized?: string[];
  integration_stub?: Record<string, unknown>;
  progress?: Array<{ step: string; status: string; message?: string; at: string }>;
  warnings?: string[];
  errors?: string[];
  dev_seeded?: boolean;
  campaign?: { id: string; name: string };
  funnel?: { id: string; name: string };
  funnel_steps?: Array<{ id: string; name: string; step_type: string; slug: string }>;
  content_assets?: Array<{ id: string; title: string; status: string }>;
  email?: {
    sequence?: { id: string; name: string };
    templates?: Array<{ id: string; name: string; subject: string; status: string }>;
  };
  tracking?: { link?: { id: string; destination_url: string } };
  notes?: string;
};

type LaunchState = {
  ok: boolean;
  run: any;
  traceId: string;
  review: ReviewModel | null;
  toolCalls: Array<{ id: string; created_at: string; tool_name: string; ok: boolean; error_code: string | null }>;
  runLogs: Array<{ id: string; created_at: string; level: string; message: string }>;
};

const sections = [
  { key: "organization", label: "Organization" },
  { key: "campaign", label: "Campaign" },
  { key: "funnel", label: "Funnel" },
  { key: "leads", label: "Lead system" },
  { key: "content", label: "Content" },
  { key: "email", label: "Email" },
  { key: "workers", label: "Workers" },
  { key: "runs", label: "Runs" },
  { key: "approvals_panel", label: "Approvals" },
  { key: "analytics", label: "Analytics" },
  { key: "tracking", label: "Tracking" },
  { key: "review", label: "Review notes" },
  { key: "logs", label: "Logs" },
] as const;

export function LaunchClient({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [runContext, setRunContext] = React.useState<RunContext | null>(null);
  const [activeSection, setActiveSection] =
    React.useState<(typeof sections)[number]["key"]>("organization");

  const [orgChoice, setOrgChoice] = React.useState<"current" | "picker" | "new">("current");
  const [selectedOrgId, setSelectedOrgId] = React.useState<string>(organizationId);
  const [newOrgName, setNewOrgName] = React.useState("");
  const [newOrgSlug, setNewOrgSlug] = React.useState("");

  const [mode, setMode] = React.useState<"affiliate" | "client">("affiliate");
  const [form, setForm] = React.useState({
    affiliate_link: "",
    niche: "",
    target_audience: "",
    traffic_source: "tiktok",
    campaign_goal: "affiliate conversions",
    client_business_name: "",
    client_offer_url: "",
    client_service_goal: "",
    notes: "",
    dev_seed: false,
  });

  const orgsQuery = useQuery({
    queryKey: ["my-organizations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizations");
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; organizations: OrgRow[] };
      return j.organizations ?? [];
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const niche = form.niche.trim();
      const audience = form.target_audience.trim();
      const traffic = form.traffic_source.trim();
      const notes = form.notes.trim() || undefined;

      const body: Record<string, unknown> = {
        mode,
        niche,
        target_audience: audience,
        traffic_source: traffic,
        notes,
        dev_seed: form.dev_seed,
      };

      if (orgChoice === "new") {
        const parsed = z
          .object({
            name: z.string().min(2),
            slug: z
              .string()
              .min(2)
              .regex(/^[a-z0-9-]+$/, "Slug: lowercase, numbers, dashes only."),
          })
          .safeParse({ name: newOrgName.trim(), slug: newOrgSlug.trim() });
        if (!parsed.success) throw new Error("New org: enter a valid name and slug.");
        body.createNewOrganization = parsed.data;
      } else if (orgChoice === "picker") {
        const p = z.string().uuid().safeParse(selectedOrgId);
        if (!p.success) throw new Error("Select an organization.");
        body.selectedOrganizationId = p.data;
      } else {
        body.organizationId = organizationId;
      }

      if (mode === "affiliate") {
        body.affiliate_link = z.string().url().parse(form.affiliate_link.trim());
        body.campaign_goal = z.string().min(2).parse(form.campaign_goal.trim());
      } else {
        body.client_business_name = z.string().min(2).parse(form.client_business_name.trim());
        body.client_offer_url = z.string().url().parse(form.client_offer_url.trim());
        body.client_service_goal = z.string().min(2).parse(form.client_service_goal.trim());
      }

      const res = await fetch("/api/workspace/provision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          organizationMode: orgChoice === "new" ? "create" : "existing",
          organizationId: orgChoice === "new" ? undefined : orgChoice === "picker" ? selectedOrgId : organizationId,
          organizationName: orgChoice === "new" ? newOrgName.trim() : undefined,
          affiliateLink: mode === "affiliate" ? (body.affiliate_link as string) : undefined,
          clientWebsite: mode === "client" ? (body.client_offer_url as string) : undefined,
          businessName: mode === "client" ? (body.client_business_name as string) : undefined,
          niche,
          audience,
          trafficSource: traffic,
          goal: mode === "affiliate" ? (body.campaign_goal as string) : (body.client_service_goal as string),
          notes,
          devSeedDemoData: Boolean(form.dev_seed),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as any;
    },
    onSuccess: (j) => {
      if (j.ok) {
        toast.success(j.createdNewOrganization ? "New org created and workspace provisioned" : "Workspace provisioned");
      } else {
        toast.warning(
          j.createdNewOrganization
            ? "New org created, but provisioning finished with errors (earlier steps were kept)."
            : "Provisioning finished with errors — review the run for what succeeded.",
        );
      }
      setRunContext({ runId: j.masterRunId, traceId: j.traceId, organizationId: j.organizationId });
      setActiveSection("organization");
      if (j.createdNewOrganization) {
        qc.invalidateQueries({ queryKey: ["my-organizations"] });
        router.refresh();
      }
      if (j.campaignId) {
        router.push(`/admin/workspace/review/${j.campaignId}`);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Launch failed"),
  });

  const stateQuery = useQuery({
    queryKey: ["launch-run", runContext?.organizationId, runContext?.runId],
    enabled: Boolean(runContext?.runId && runContext?.organizationId),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/launch/run/${runContext?.runId}?organizationId=${runContext?.organizationId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as LaunchState;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (section: string) => {
      if (!runContext) throw new Error("No run selected");
      const res = await fetch(`/api/admin/launch/run/${runContext.runId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: runContext.organizationId, section }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => stateQuery.refetch(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Approve failed"),
  });

  const regenMutation = useMutation({
    mutationFn: async (section: string) => {
      if (!runContext) throw new Error("No run selected");
      const res = await fetch(`/api/admin/launch/run/${runContext.runId}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: runContext.organizationId, section }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      toast.success("Regenerated");
      stateQuery.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Regenerate failed"),
  });

  const data = stateQuery.data;
  const review = data?.review ?? null;
  const approvals = review?.approvals ?? {};
  const orgIdForLinks = runContext?.organizationId ?? organizationId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace launcher</h1>
        <p className="text-sm text-muted-foreground">
          Provision a full org workspace (campaign, funnel, content, email, workers, approvals, analytics scaffolding)
          with audit + tool traces. External publish/send remains gated or stubbed until providers are live.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={orgChoice === "current"}
                onChange={() => setOrgChoice("current")}
              />
              Use current org (cookie)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={orgChoice === "picker"}
                onChange={() => setOrgChoice("picker")}
              />
              Pick existing org
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={orgChoice === "new"} onChange={() => setOrgChoice("new")} />
              Create new org
            </label>
          </div>

          {orgChoice === "picker" ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">Organization</div>
              <Select
                value={selectedOrgId}
                onValueChange={(value) => setSelectedOrgId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select org" />
                </SelectTrigger>
                <SelectContent>
                  {(orgsQuery.data ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} ({o.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {orgChoice === "new" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">New org name</label>
                <Input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Acme Marketing" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New org slug</label>
                <Input value={newOrgSlug} onChange={(e) => setNewOrgSlug(e.target.value)} placeholder="acme-marketing" />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Launch mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "affiliate"} onChange={() => setMode("affiliate")} />
              Affiliate campaign
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "client"} onChange={() => setMode("client")} />
              Client / business workspace
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Niche</label>
              <Input value={form.niche} onChange={(e) => setForm((s) => ({ ...s, niche: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target audience</label>
              <Input
                value={form.target_audience}
                onChange={(e) => setForm((s) => ({ ...s, target_audience: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Traffic source</label>
              <Select
                value={form.traffic_source}
                onValueChange={(v) => setForm((s) => ({ ...s, traffic_source: v ?? "" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
                  <SelectItem value="seo">SEO</SelectItem>
                  <SelectItem value="ads">Paid ads</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "affiliate" ? (
              <>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Affiliate link</label>
                  <Input
                    value={form.affiliate_link}
                    onChange={(e) => setForm((s) => ({ ...s, affiliate_link: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Campaign goal</label>
                  <Input
                    value={form.campaign_goal}
                    onChange={(e) => setForm((s) => ({ ...s, campaign_goal: e.target.value }))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client / business name</label>
                  <Input
                    value={form.client_business_name}
                    onChange={(e) => setForm((s) => ({ ...s, client_business_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Website or offer URL</label>
                  <Input
                    value={form.client_offer_url}
                    onChange={(e) => setForm((s) => ({ ...s, client_offer_url: e.target.value }))}
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Service goal</label>
                  <Input
                    value={form.client_service_goal}
                    onChange={(e) => setForm((s) => ({ ...s, client_service_goal: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Optional notes</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.dev_seed}
                onChange={(e) => setForm((s) => ({ ...s, dev_seed: e.target.checked }))}
              />
              Request dev seed (sample lead + analytics) — only runs when server has{" "}
              <span className="font-mono">NODE_ENV=development</span> and{" "}
              <span className="font-mono">WORKSPACE_DEV_SEED=1</span>
            </label>
          </div>

          <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
            {startMutation.isPending ? "Provisioning…" : "Provision workspace"}
          </Button>
        </CardContent>
      </Card>

      {!runContext ? null : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Org: <span className="font-mono">{runContext.organizationId.slice(0, 8)}…</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Run: <span className="font-mono">{runContext.runId.slice(0, 8)}…</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Trace: <span className="font-mono">{runContext.traceId}</span>
              </div>
              <Separator className="my-2 opacity-60" />
              <div className="space-y-1">
                {sections.map((s) => (
                  <Button
                    key={s.key}
                    variant={activeSection === s.key ? "default" : "outline"}
                    className="w-full justify-between"
                    onClick={() => setActiveSection(s.key)}
                  >
                    <span>{s.label}</span>
                    <span className="text-xs opacity-80">{approvals[s.key] ? "✓" : ""}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Status: {data?.run?.status ?? "—"}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!review || approveMutation.isPending}
                  onClick={() => approveMutation.mutate(activeSection)}
                >
                  Approve section
                </Button>
                <Button
                  variant="outline"
                  disabled={!review || regenMutation.isPending}
                  onClick={() => regenMutation.mutate(activeSection)}
                >
                  Regenerate section
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href="/admin/campaigns" />}>
                  Open campaigns
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href="/admin/funnels" />}>
                  Open funnels
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href="/admin/content" />}>
                  Open content
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href="/admin/email" />}>
                  Open email
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href="/admin/approvals" />}>
                  Open approvals
                </Button>
                {review?.campaign?.id ? (
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/admin/campaigns/${review.campaign.id}/automation`} />}
                  >
                    Campaign automation
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            {(review?.warnings?.length ?? 0) > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Warnings</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-amber-700 dark:text-amber-400">
                  <ul className="list-disc space-y-1 pl-4">
                    {(review?.warnings ?? []).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            {(review?.errors?.length ?? 0) > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Errors</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-destructive">
                  <ul className="list-disc space-y-1 pl-4">
                    {(review?.errors ?? []).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            {review?.progress && review.progress.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Orchestration progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Step</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {review.progress.map((p, i) => (
                        <TableRow key={`${p.step}-${i}`}>
                          <TableCell className="font-mono text-xs">{p.step}</TableCell>
                          <TableCell className="text-xs">{p.status}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(p.at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Section: {activeSection}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!review ? (
                  <div className="text-muted-foreground">Loading review…</div>
                ) : activeSection === "organization" ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-muted-foreground">Organization ID:</span>{" "}
                      <span className="font-mono text-xs">{review.organization?.id ?? orgIdForLinks}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mode:</span> {review.mode ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Settings keys initialized:</span>{" "}
                      {(review.settings_keys_initialized ?? []).join(", ") || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Integration:{" "}
                      <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-border/60 p-2 text-[11px]">
                        {JSON.stringify(review.integration_stub ?? {}, null, 2)}
                      </pre>
                    </div>
                    {review.dev_seeded ? <div className="text-xs font-medium">Dev seed applied.</div> : null}
                  </div>
                ) : activeSection === "campaign" ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-muted-foreground">Campaign:</span>{" "}
                      <span className="font-mono text-xs">{review.campaign?.id ?? "—"}</span>{" "}
                      <span className="font-medium">{review.campaign?.name ?? ""}</span>
                    </div>
                  </div>
                ) : activeSection === "funnel" ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-muted-foreground">Funnel:</span>{" "}
                      <span className="font-mono text-xs">{review.funnel?.id ?? "—"}</span>{" "}
                      <span className="font-medium">{review.funnel?.name ?? ""}</span>
                    </div>
                    <ul className="mt-1 space-y-1">
                      {(review.funnel_steps ?? []).map((st) => (
                        <li key={st.id} className="rounded-md border border-border/60 p-2">
                          <div className="font-medium">{st.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {st.step_type} · {st.slug}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : activeSection === "leads" ? (
                  <div className="space-y-2">
                    <div className="font-medium">Pipeline configuration (not live leads)</div>
                    <p className="text-xs text-muted-foreground">{review.lead_system?.summary}</p>
                    <div className="text-xs">
                      Settings key: <span className="font-mono">{review.lead_system?.settings_key}</span>
                    </div>
                  </div>
                ) : activeSection === "content" ? (
                  <ul className="space-y-1">
                    {(review.content_assets ?? []).map((a) => (
                      <li key={a.id} className="rounded-md border border-border/60 p-2">
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-muted-foreground">{a.status}</div>
                      </li>
                    ))}
                  </ul>
                ) : activeSection === "email" ? (
                  <div className="space-y-2">
                    <div>
                      Sequence:{" "}
                      <span className="font-mono text-xs">{review.email?.sequence?.id ?? "—"}</span>{" "}
                      {review.email?.sequence?.name}
                    </div>
                    <ul className="space-y-1">
                      {(review.email?.templates ?? []).map((t) => (
                        <li key={t.id} className="rounded-md border border-border/60 p-2 text-xs">
                          {t.name} — {t.subject}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : activeSection === "workers" ? (
                  <ul className="space-y-1">
                    {(review.workers?.assigned ?? []).map((w) => (
                      <li key={w.agent_key} className="rounded-md border border-border/60 p-2 text-xs">
                        {w.agent_key}{" "}
                        {w.id ? <span className="font-mono text-muted-foreground">{w.id.slice(0, 8)}…</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : activeSection === "runs" ? (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Master run (this page)</div>
                    <div className="font-mono text-xs">{runContext.runId}</div>
                    <div className="text-xs text-muted-foreground mt-2">Child runs (pending stubs)</div>
                    <ul className="space-y-1">
                      {(review.child_runs ?? []).map((cr) => (
                        <li key={cr.id}>
                          <a className="text-primary underline" href={`/admin/ai-workers/runs/${cr.id}`}>
                            {cr.agent_key}: {cr.id.slice(0, 8)}…
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : activeSection === "approvals_panel" ? (
                  <ul className="space-y-1">
                    {(review.approval_items ?? []).map((a) => (
                      <li key={a.id} className="rounded-md border border-border/60 p-2 text-xs">
                        <span className="font-medium">{a.approval_type}</span>{" "}
                        <span className="font-mono text-muted-foreground">{a.id.slice(0, 8)}…</span>
                      </li>
                    ))}
                  </ul>
                ) : activeSection === "analytics" ? (
                  <div className="space-y-1 text-xs">
                    <div>Baseline event logged: {review.analytics?.baseline_logged ? "yes" : "no"}</div>
                    <div>Event: {review.analytics?.event ?? "—"}</div>
                  </div>
                ) : activeSection === "tracking" ? (
                  <div className="space-y-1 text-xs">
                    <div>Link ID: {review.tracking?.link?.id ?? "—"}</div>
                    <div className="break-all">Destination: {review.tracking?.link?.destination_url ?? "—"}</div>
                  </div>
                ) : activeSection === "logs" ? (
                  <div className="text-xs text-muted-foreground">
                    Orchestration logs are attached to this run. Open{" "}
                    <a className="text-primary underline" href="/admin/logs">
                      /admin/logs
                    </a>{" "}
                    for org-wide audit.
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap rounded-md border border-border/60 p-3">
                    {review.notes ?? "—"}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tool calls (trace)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Tool</TableHead>
                        <TableHead>OK</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.toolCalls ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-sm text-muted-foreground">
                            No tool calls.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (data?.toolCalls ?? []).map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(t.created_at).toLocaleTimeString()}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{t.tool_name}</TableCell>
                            <TableCell className="text-xs">{t.ok ? "yes" : `no (${t.error_code ?? "err"})`}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Run logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.runLogs ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-sm text-muted-foreground">
                            No logs.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (data?.runLogs ?? []).map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(l.created_at).toLocaleTimeString()}
                            </TableCell>
                            <TableCell className="text-xs">{l.level}</TableCell>
                            <TableCell className="text-xs">{l.message}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
