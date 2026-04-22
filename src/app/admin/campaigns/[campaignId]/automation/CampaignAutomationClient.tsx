"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const settingsSchema = z.object({
  automation_enabled: z.boolean(),
  auto_generate_content_drafts: z.boolean(),
  auto_run_analyst_weekly: z.boolean(),
  require_approval_before_publish: z.boolean(),
  require_approval_before_email: z.boolean(),
  auto_log_analytics_reviews: z.boolean(),
  max_runs_per_day: z.number().int().min(0).max(50),
});

type CampaignAutomationSettings = z.infer<typeof settingsSchema>;

type ScheduleRow = {
  id: string;
  name: string;
  enabled: boolean;
  cron_expression: string;
  timezone: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  last_error?: string | null;
  backoff_until?: string | null;
  failure_count?: number | null;
  agents?: { key?: string; name?: string } | null;
};

export function CampaignAutomationClient({ organizationId }: { organizationId: string }) {
  const params = useParams();
  const campaignId = String((params as any)?.campaignId ?? "");
  const qc = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["campaign-automation", organizationId, campaignId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/automation/campaign?organizationId=${organizationId}&campaignId=${campaignId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { ok: boolean; settings: CampaignAutomationSettings | null };
      return (
        json.settings ?? {
          automation_enabled: false,
          auto_generate_content_drafts: false,
          auto_run_analyst_weekly: false,
          require_approval_before_publish: true,
          require_approval_before_email: true,
          auto_log_analytics_reviews: false,
          max_runs_per_day: 3,
        }
      );
    },
    enabled: Boolean(campaignId),
  });

  const schedulesQuery = useQuery({
    queryKey: ["campaign-schedules", organizationId, campaignId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/openclaw/schedules?organizationId=${organizationId}&campaignId=${campaignId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { ok: boolean; schedules: ScheduleRow[] };
      return json.schedules ?? [];
    },
    enabled: Boolean(campaignId),
  });

  const [form, setForm] = React.useState<CampaignAutomationSettings | null>(null);
  React.useEffect(() => {
    if (!settingsQuery.data) return;
    setForm(settingsQuery.data);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("No settings loaded");
      const payload = settingsSchema.parse(form);
      const res = await fetch("/api/admin/automation/campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          campaignId,
          ...payload,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Automation settings saved");
      await qc.invalidateQueries({ queryKey: ["campaign-automation", organizationId, campaignId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const schedules = schedulesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaign · Automation control</h1>
        <p className="text-sm text-muted-foreground">
          Safe-by-default automation scaffolding. Schedules will only run if automation is enabled and guardrails allow it.
        </p>
        <p className="mt-1 text-xs text-muted-foreground font-mono">campaignId={campaignId}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Automation settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!form ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Automation enabled</div>
                  <div className="text-xs text-muted-foreground">
                    Disabled by default. Required for any campaign schedule to execute.
                  </div>
                </div>
                <Switch
                  checked={form.automation_enabled}
                  onCheckedChange={(v) => setForm((s) => (s ? { ...s, automation_enabled: v } : s))}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div>
                    <div className="text-sm font-medium">Auto-generate content drafts</div>
                    <div className="text-xs text-muted-foreground">Draft-only; no publishing.</div>
                  </div>
                  <Switch
                    checked={form.auto_generate_content_drafts}
                    onCheckedChange={(v) =>
                      setForm((s) => (s ? { ...s, auto_generate_content_drafts: v } : s))
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div>
                    <div className="text-sm font-medium">Auto-run analyst weekly</div>
                    <div className="text-xs text-muted-foreground">Creates run records + logs.</div>
                  </div>
                  <Switch
                    checked={form.auto_run_analyst_weekly}
                    onCheckedChange={(v) =>
                      setForm((s) => (s ? { ...s, auto_run_analyst_weekly: v } : s))
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div>
                    <div className="text-sm font-medium">Require approval before publish</div>
                    <div className="text-xs text-muted-foreground">Recommended (default on).</div>
                  </div>
                  <Switch
                    checked={form.require_approval_before_publish}
                    onCheckedChange={(v) =>
                      setForm((s) => (s ? { ...s, require_approval_before_publish: v } : s))
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div>
                    <div className="text-sm font-medium">Require approval before email</div>
                    <div className="text-xs text-muted-foreground">Recommended (default on).</div>
                  </div>
                  <Switch
                    checked={form.require_approval_before_email}
                    onCheckedChange={(v) =>
                      setForm((s) => (s ? { ...s, require_approval_before_email: v } : s))
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 md:col-span-2">
                  <div>
                    <div className="text-sm font-medium">Auto-log analytics reviews</div>
                    <div className="text-xs text-muted-foreground">
                      Writes review notes/events to keep a transparent audit trail.
                    </div>
                  </div>
                  <Switch
                    checked={form.auto_log_analytics_reviews}
                    onCheckedChange={(v) =>
                      setForm((s) => (s ? { ...s, auto_log_analytics_reviews: v } : s))
                    }
                  />
                </label>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Max runs per day</div>
                  <Input
                    value={String(form.max_runs_per_day)}
                    onChange={(e) =>
                      setForm((s) =>
                        s ? { ...s, max_runs_per_day: Number(e.target.value || "0") } : s,
                      )
                    }
                    inputMode="numeric"
                  />
                  <div className="text-xs text-muted-foreground">
                    Guardrail enforced by scheduler (per-campaign).
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  Save settings
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Scheduled runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead>Backoff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    No schedules for this campaign yet. Create them under OpenClaw schedules (operators).
                  </TableCell>
                </TableRow>
              ) : (
                schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">
                      {s.name}
                      {s.last_error ? (
                        <div className="mt-1 text-xs text-destructive">{String(s.last_error).slice(0, 140)}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-muted-foreground font-mono">{s.cron_expression}</div>
                    </TableCell>
                    <TableCell className="text-sm">{s.agents?.name ?? s.agents?.key ?? "—"}</TableCell>
                    <TableCell className="text-sm">{s.enabled ? "yes" : "no"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.next_run_at ? new Date(s.next_run_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.backoff_until ? new Date(s.backoff_until).toLocaleString() : "—"}
                      {Number(s.failure_count ?? 0) > 0 ? ` · fails=${s.failure_count}` : ""}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

