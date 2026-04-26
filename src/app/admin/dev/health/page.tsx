import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { describeOpenClawBackend } from "@/lib/openclaw/factory";
import { TOOLS } from "@/lib/openclaw/tools/tools";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/auth/authService";
import { assertOrgOperator } from "@/services/org/assertOrgAccess";
import { env } from "@/lib/env";
import { OPENCLAW_AGENT_REGISTRY } from "@/lib/openclaw/registry";

type CountRow = { label: string; value: number | null; note?: string | null };

async function safeCount(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: string,
  orgId: string,
) {
  const { count, error } = await supabase
    .from(table as never)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  return { count: error ? null : (count ?? 0), error: error?.message ?? null };
}

export default async function AdminDevHealthPage() {
  const user = await requireUser();
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  const supabase = await createSupabaseServerClient();
  try {
    await assertOrgOperator(supabase, user.id, orgId);
  } catch {
    redirect("/admin");
  }

  // Active org details (best-effort)
  const { data: orgRow } = await supabase
    .from("organizations" as never)
    .select("id,name,slug,created_at")
    .eq("id", orgId)
    .maybeSingle();

  // DB health: simple query
  const dbHealth = await (async () => {
    try {
      const { error } = await supabase
        .from("organizations" as never)
        .select("id", { head: true })
        .limit(1);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: "OK" };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Unknown error" };
    }
  })();

  // Counts
  const [
    campaigns,
    funnels,
    leads,
    contentAssets,
    sequences,
    workers,
    runs,
    approvals,
    analyticsEvents,
    auditLogs,
    agentLogs,
    emailLogs,
    toolCalls,
  ] = await Promise.all([
    safeCount(supabase, "campaigns", orgId),
    safeCount(supabase, "funnels", orgId),
    safeCount(supabase, "leads", orgId),
    safeCount(supabase, "content_assets", orgId),
    safeCount(supabase, "email_sequences", orgId),
    safeCount(supabase, "agents", orgId),
    safeCount(supabase, "agent_runs", orgId),
    safeCount(supabase, "approvals", orgId),
    safeCount(supabase, "analytics_events", orgId),
    safeCount(supabase, "audit_logs", orgId),
    safeCount(supabase, "agent_logs", orgId),
    safeCount(supabase, "email_logs", orgId),
    safeCount(supabase, "openclaw_tool_calls", orgId),
  ]);

  const counts: CountRow[] = [
    { label: "Campaigns", value: campaigns.count, note: campaigns.error },
    { label: "Funnels", value: funnels.count, note: funnels.error },
    { label: "Leads", value: leads.count, note: leads.error },
    { label: "Content assets", value: contentAssets.count, note: contentAssets.error },
    { label: "Email sequences", value: sequences.count, note: sequences.error },
    { label: "Workers (agents)", value: workers.count, note: workers.error },
    { label: "Agent runs", value: runs.count, note: runs.error },
    { label: "Approvals", value: approvals.count, note: approvals.error },
    { label: "Analytics events", value: analyticsEvents.count, note: analyticsEvents.error },
    { label: "Audit logs", value: auditLogs.count, note: auditLogs.error },
    { label: "Agent logs", value: agentLogs.count, note: agentLogs.error },
    { label: "Email logs", value: emailLogs.count, note: emailLogs.error },
    { label: "OpenClaw tool calls", value: toolCalls.count, note: toolCalls.error },
  ];

  // Latest audit logs
  const { data: latestAudit } = await supabase
    .from("audit_logs" as never)
    .select("id,action,entity_type,entity_id,actor_user_id,created_at,metadata")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10);

  // Latest agent runs
  const { data: latestRuns } = await supabase
    .from("agent_runs" as never)
    .select("id,status,agent_id,campaign_id,output_summary,error_message,created_at,started_at,finished_at,agents(key,name)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10);

  // Latest workspace provision run (best-effort): run.input has role_mode=workspace_orchestrator
  const { data: latestProvision } = await supabase
    .from("agent_runs" as never)
    .select("id,status,output_summary,error_message,created_at,started_at,finished_at,agents(key,name),input")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(25);
  const latestProvisionRun = (latestProvision ?? []).find((r: any) => String(r?.input?.role_mode ?? "") === "workspace_orchestrator") ?? null;

  // Worker permissions sanity: org agents with empty allowed_tools
  const { data: agentsPerm } = await supabase
    .from("agents" as never)
    .select("id,key,name,allowed_tools")
    .eq("organization_id", orgId)
    .order("key", { ascending: true })
    .limit(200);
  const emptyAllowedTools = (agentsPerm ?? []).filter((a: any) => !Array.isArray(a.allowed_tools) || a.allowed_tools.length === 0);

  // Latest analytics events
  const { data: latestEvents } = await supabase
    .from("analytics_events" as never)
    .select("id,event_name,source,session_id,created_at,campaign_id,lead_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10);

  const { count: pendingApprovalsCount } = await supabase
    .from("approvals" as never)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "pending");

  const { data: latestSchedules } = await supabase
    .from("agent_scheduled_tasks" as never)
    .select("id,name,enabled,next_run_at,last_run_at,failure_count,backoff_until,last_error,agents(key,name)")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(10);

  // Provider statuses
  const openclawBackend = describeOpenClawBackend();
  const providers = {
    openclaw: {
      active: openclawBackend.active,
      httpConfigured: openclawBackend.httpConfigured,
    },
    resend: {
      configured: Boolean(env.server.RESEND_API_KEY && env.server.RESEND_FROM_EMAIL),
    },
    posthog: {
      configured: Boolean(env.client.NEXT_PUBLIC_POSTHOG_API_KEY && env.client.NEXT_PUBLIC_POSTHOG_HOST),
    },
  };

  const { data: latestToolCalls } = await supabase
    .from("openclaw_tool_calls" as never)
    .select("id,tool_name,ok,error_code,created_at,trace_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10);

  // “System errors” (best-effort): show latest failed runs + failed email logs.
  const { data: failedRuns } = await supabase
    .from("agent_runs" as never)
    .select("id,status,error_message,created_at,agents(key,name)")
    .eq("organization_id", orgId)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: failedEmails } = await supabase
    .from("email_logs" as never)
    .select("id,to_email,subject,status,error_message,created_at")
    .eq("organization_id", orgId)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Diagnostics · Health</h1>
        <p className="text-sm text-muted-foreground">
          Internal admin-only debugging view. Not linked in navigation.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Auth</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">User:</span>{" "}
              <span className="font-mono text-xs">{user.email ?? user.id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">User ID:</span>{" "}
              <span className="font-mono text-xs">{user.id}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Org ID:</span>{" "}
              <span className="font-mono text-xs">{orgId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Name:</span>{" "}
              <span>{(orgRow as any)?.name ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Slug:</span>{" "}
              <span className="font-mono text-xs">{(orgRow as any)?.slug ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">DB</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Connection:</span>
              <Badge variant={dbHealth.ok ? "secondary" : "destructive"}>
                {dbHealth.ok ? "OK" : "ERROR"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">{dbHealth.message}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">OpenClaw</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Provider mode</span>
              <Badge variant={providers.openclaw.active === "stub" ? "outline" : "secondary"}>
                {providers.openclaw.active}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">HTTP configured</span>
              <Badge variant={providers.openclaw.httpConfigured ? "secondary" : "outline"}>
                {providers.openclaw.httpConfigured ? "yes" : "no"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Registry workers: {OPENCLAW_AGENT_REGISTRY.length} · Tools: {TOOLS.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Worker permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Agents with empty tools</span>
              <Badge variant={emptyAllowedTools.length > 0 ? "destructive" : "secondary"}>
                {emptyAllowedTools.length}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Empty tools means the worker can’t execute any tool-driven changes.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Latest provision run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Run</span>
              <span className="font-mono text-xs">{latestProvisionRun ? String((latestProvisionRun as any).id).slice(0, 8) : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={(latestProvisionRun as any)?.status === "failed" ? "destructive" : "secondary"}>
                {(latestProvisionRun as any)?.status ?? "—"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground line-clamp-3">
              {(latestProvisionRun as any)?.output_summary ?? (latestProvisionRun as any)?.error_message ?? ""}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending approvals</span>
              <Badge variant={Number(pendingApprovalsCount ?? 0) > 0 ? "destructive" : "secondary"}>
                {pendingApprovalsCount ?? 0}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              High-risk actions should remain gated; this is a quick “backpressure” signal.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Counts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {counts.map((c) => (
              <div key={c.label} className="rounded-lg border border-border/60 p-3">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {c.value === null ? "—" : c.value}
                </div>
                {c.note ? <div className="mt-1 text-xs text-destructive">{c.note}</div> : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Latest audit logs (10)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(latestAudit ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      No audit logs.
                    </TableCell>
                  </TableRow>
                ) : (
                  (latestAudit ?? []).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(a.entity_type ?? "—") as string}
                        {a.entity_id ? ` · ${String(a.entity_id).slice(0, 8)}…` : ""}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Latest agent runs (10)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(latestRuns ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      No runs.
                    </TableCell>
                  </TableRow>
                ) : (
                  (latestRuns ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.agents?.name ?? "—"}
                        <div className="text-xs text-muted-foreground">{r.agents?.key ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Latest schedules (10)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Next</TableHead>
                <TableHead>Backoff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(latestSchedules ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No schedules.
                  </TableCell>
                </TableRow>
              ) : (
                (latestSchedules ?? []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">
                      {s.name}
                      <div className="text-xs text-muted-foreground">{s.agents?.key ?? ""}</div>
                      {s.last_error ? (
                        <div className="mt-1 text-xs text-destructive">{String(s.last_error).slice(0, 180)}</div>
                      ) : null}
                    </TableCell>
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Latest analytics events (10)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(latestEvents ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">
                    No analytics events.
                  </TableCell>
                </TableRow>
              ) : (
                (latestEvents ?? []).map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{e.event_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.source}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Provider status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">OpenClaw:</span>
            <Badge variant="secondary">{providers.openclaw.active}</Badge>
            <span className="text-muted-foreground">
              {providers.openclaw.httpConfigured ? "HTTP configured" : "stub mode"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Resend:</span>
            <Badge variant={providers.resend.configured ? "secondary" : "destructive"}>
              {providers.resend.configured ? "configured" : "not configured"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">PostHog:</span>
            <Badge variant={providers.posthog.configured ? "secondary" : "destructive"}>
              {providers.posthog.configured ? "configured" : "not configured"}
            </Badge>
          </div>
          <Separator className="opacity-60" />
          <div className="text-xs text-muted-foreground">
            Note: provider “live/stub” does not imply DB availability; DB health is shown above.
          </div>
          <Separator className="opacity-60" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">OpenClaw tools registered:</span>
            <Badge variant="secondary">{TOOLS.length}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Latest OpenClaw tool calls (10)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>OK</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(latestToolCalls ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No tool calls.
                  </TableCell>
                </TableRow>
              ) : (
                (latestToolCalls ?? []).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{t.tool_name}</TableCell>
                    <TableCell className="text-sm">{t.ok ? "yes" : "no"}</TableCell>
                    <TableCell className="text-xs text-destructive">{t.error_code ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Latest failed runs (10)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(failedRuns ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      No failed runs.
                    </TableCell>
                  </TableRow>
                ) : (
                  (failedRuns ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.agents?.name ?? "—"}
                        <div className="text-xs text-muted-foreground">{r.agents?.key ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-xs text-destructive">{r.error_message ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Latest failed emails (10)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(failedEmails ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      No failed emails.
                    </TableCell>
                  </TableRow>
                ) : (
                  (failedEmails ?? []).map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.to_email}</TableCell>
                      <TableCell className="text-xs text-destructive">{e.error_message ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

