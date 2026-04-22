"use client";

import * as React from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  affiliate_link: z.string().min(4),
  niche: z.string().min(2),
  target_audience: z.string().min(2),
  traffic_source: z.string().min(2),
  campaign_goal: z.string().min(2),
  notes: z.string().optional(),
});

type LauncherResult = {
  runId: string;
  traceId: string;
};

type LaunchState = {
  ok: boolean;
  run: any;
  traceId: string;
  review: {
    approvals: Record<string, boolean>;
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
  } | null;
  toolCalls: Array<{ id: string; created_at: string; tool_name: string; ok: boolean; error_code: string | null }>;
  runLogs: Array<{ id: string; created_at: string; level: string; message: string }>;
};

const sections = [
  { key: "campaign", label: "Campaign" },
  { key: "funnel", label: "Funnel" },
  { key: "content", label: "Content" },
  { key: "email", label: "Email" },
  { key: "tracking", label: "Tracking" },
  { key: "review", label: "Review notes" },
] as const;

export function LaunchClient({ organizationId }: { organizationId: string }) {
  const [activeRun, setActiveRun] = React.useState<LauncherResult | null>(null);
  const [activeSection, setActiveSection] =
    React.useState<(typeof sections)[number]["key"]>("campaign");

  const [form, setForm] = React.useState(() => ({
    affiliate_link: "",
    niche: "",
    target_audience: "",
    traffic_source: "tiktok",
    campaign_goal: "affiliate conversions",
    notes: "",
  }));

  const startMutation = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.parse(form);
      const res = await fetch("/api/admin/launch/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, ...parsed }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; runId: string; traceId: string };
    },
    onSuccess: (j) => {
      toast.success("Launcher run created");
      setActiveRun({ runId: j.runId, traceId: j.traceId });
      setActiveSection("campaign");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Launch failed"),
  });

  const stateQuery = useQuery({
    queryKey: ["launch-run", organizationId, activeRun?.runId],
    enabled: Boolean(activeRun?.runId),
    refetchInterval: (q) => (q.state.data?.run?.status === "running" ? 1500 : false),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/launch/run/${activeRun?.runId}?organizationId=${organizationId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as LaunchState;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (section: string) => {
      if (!activeRun) throw new Error("No run selected");
      const res = await fetch(`/api/admin/launch/run/${activeRun.runId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, section }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => stateQuery.refetch(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Approve failed"),
  });

  const regenMutation = useMutation({
    mutationFn: async (section: string) => {
      if (!activeRun) throw new Error("No run selected");
      const res = await fetch(`/api/admin/launch/run/${activeRun.runId}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, section }),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Campaign Launcher</h1>
        <p className="text-sm text-muted-foreground">
          Generate a campaign draft (campaign + funnel + assets + email + tracking) with full tool-call traceability.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Affiliate link</label>
              <Input value={form.affiliate_link} onChange={(e) => setForm((s) => ({ ...s, affiliate_link: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Niche</label>
              <Input value={form.niche} onChange={(e) => setForm((s) => ({ ...s, niche: e.target.value }))} placeholder="AI SEO" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target audience</label>
              <Input value={form.target_audience} onChange={(e) => setForm((s) => ({ ...s, target_audience: e.target.value }))} placeholder="SaaS founders" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Traffic source</label>
              <Select
                value={form.traffic_source}
                onValueChange={(v) => setForm((s) => ({ ...s, traffic_source: v as string }))}
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
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Campaign goal</label>
              <Input value={form.campaign_goal} onChange={(e) => setForm((s) => ({ ...s, campaign_goal: e.target.value }))} placeholder="affiliate conversions" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Optional notes</label>
              <Textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} rows={3} placeholder="Brand voice, offer notes, constraints..." />
            </div>
          </div>

          <Button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
          >
            {startMutation.isPending ? "Launching…" : "Launch"}
          </Button>
        </CardContent>
      </Card>

      {!activeRun ? null : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Run: <span className="font-mono">{activeRun.runId.slice(0, 8)}…</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Trace: <span className="font-mono">{activeRun.traceId}</span>
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
                    <span className="text-xs opacity-80">
                      {approvals[s.key] ? "approved" : ""}
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Status: {data?.run?.status ?? "—"}
                </CardTitle>
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
                <Button
                  variant="outline"
                  disabled={!review}
                  onClick={() => {
                    toast.message("Manual edit", {
                      description:
                        "Use the IDs below to edit in Campaigns/Funnels/Content/Email modules. (Detail screens can be added next.)",
                    });
                  }}
                >
                  Edit manually
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Section: {activeSection}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                {!review ? (
                  <div className="text-muted-foreground">No review model yet.</div>
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
                    <div>
                      <div className="text-xs text-muted-foreground">Steps</div>
                      <ul className="mt-1 space-y-1">
                        {(review.funnel_steps ?? []).map((st) => (
                          <li key={st.id} className="rounded-md border border-border/60 p-2">
                            <div className="font-medium">{st.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {st.step_type} · /{st.slug} · <span className="font-mono">{st.id.slice(0, 8)}…</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : activeSection === "content" ? (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Content assets</div>
                    <ul className="mt-1 space-y-1">
                      {(review.content_assets ?? []).map((a) => (
                        <li key={a.id} className="rounded-md border border-border/60 p-2">
                          <div className="font-medium">{a.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.status} · <span className="font-mono">{a.id.slice(0, 8)}…</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : activeSection === "email" ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-muted-foreground">Sequence:</span>{" "}
                      <span className="font-mono text-xs">{review.email?.sequence?.id ?? "—"}</span>{" "}
                      <span className="font-medium">{review.email?.sequence?.name ?? ""}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Templates</div>
                    <ul className="mt-1 space-y-1">
                      {(review.email?.templates ?? []).map((t) => (
                        <li key={t.id} className="rounded-md border border-border/60 p-2">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.status} · {t.subject} · <span className="font-mono">{t.id.slice(0, 8)}…</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : activeSection === "tracking" ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-muted-foreground">Link:</span>{" "}
                      <span className="font-mono text-xs">{review.tracking?.link?.id ?? "—"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Destination: {review.tracking?.link?.destination_url ?? "—"}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Notes</div>
                    <div className="whitespace-pre-wrap rounded-md border border-border/60 p-3">
                      {review.notes ?? "—"}
                    </div>
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
                            No tool calls yet.
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
                            No logs yet.
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

