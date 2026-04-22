import type { SupabaseClient } from "@supabase/supabase-js";

import { computeNextRunIso } from "@/lib/cron/nextRun";
import {
  createPendingRun,
  executePendingRun,
} from "@/services/openclaw/orchestrationService";

async function getAutomationKillSwitch(
  db: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  const { data } = await db
    .from("settings" as never)
    .select("value")
    .eq("organization_id", organizationId)
    .eq("key", "automation")
    .maybeSingle();

  const v = (data as any)?.value as Record<string, unknown> | undefined;
  return Boolean(v?.disabled);
}

async function isCampaignAutomationEnabled(
  db: SupabaseClient,
  organizationId: string,
  campaignId: string,
): Promise<{ enabled: boolean; maxRunsPerDay: number }> {
  const { data } = await db
    .from("campaign_automation_settings" as never)
    .select("automation_enabled,max_runs_per_day")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  const row = data as any | null;
  if (!row) return { enabled: false, maxRunsPerDay: 0 };
  return {
    enabled: Boolean(row.automation_enabled),
    maxRunsPerDay: Number(row.max_runs_per_day ?? 0),
  };
}

async function countRunsToday(
  db: SupabaseClient,
  organizationId: string,
  campaignId: string | null,
) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  let q = db
    .from("agent_runs" as never)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", start.toISOString());
  if (campaignId) q = q.eq("campaign_id", campaignId);
  const { count } = await q;
  return count ?? 0;
}

function computeBackoffMinutes(failureCount: number) {
  // 5m, 10m, 20m, 40m, 80m … capped at 24h
  const mins = Math.min(5 * Math.pow(2, Math.max(0, failureCount - 1)), 24 * 60);
  return Math.round(mins);
}

async function resolveOperatorUserId(
  db: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data: member, error } = await db
    .from("organization_members" as never)
    .select("user_id")
    .eq("organization_id", organizationId)
    .in("role", ["admin", "operator"])
    .limit(1)
    .maybeSingle();

  if (error || !member) return null;
  return (member as { user_id: string }).user_id;
}

/**
 * Queue-friendly runner: find due schedules and enqueue agent runs.
 * Wire to Vercel Cron (`/api/cron/agent-schedules`) or an external worker.
 * `next_run_at` is advanced using the task's cron expression + timezone (via `croner`).
 */
export async function processDueAgentSchedules(
  db: SupabaseClient,
  opts: { organizationId?: string; actorUserId?: string; limit?: number },
): Promise<{ processed: number; skipped: number }> {
  const limit = opts.limit ?? 10;
  let q = db
    .from("agent_scheduled_tasks" as never)
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", new Date().toISOString());

  if (opts.organizationId) q = q.eq("organization_id", opts.organizationId);

  const { data: tasks, error } = await q
    .order("next_run_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let processed = 0;
  let skipped = 0;

  for (const task of tasks ?? []) {
    const t = task as {
      id: string;
      organization_id: string;
      agent_id: string;
      campaign_id: string | null;
      payload: Record<string, unknown>;
      cron_expression: string;
      timezone: string | null;
      backoff_until?: string | null;
      failure_count?: number | null;
    };

    // Org-level kill switch
    if (await getAutomationKillSwitch(db, t.organization_id)) {
      skipped += 1;
      continue;
    }

    // Backoff window
    if (t.backoff_until && new Date(t.backoff_until).getTime() > Date.now()) {
      skipped += 1;
      continue;
    }

    // Per-campaign enable + daily rate limit
    if (t.campaign_id) {
      const cfg = await isCampaignAutomationEnabled(db, t.organization_id, t.campaign_id);
      if (!cfg.enabled) {
        skipped += 1;
        continue;
      }
      const used = await countRunsToday(db, t.organization_id, t.campaign_id);
      if (cfg.maxRunsPerDay > 0 && used >= cfg.maxRunsPerDay) {
        skipped += 1;
        continue;
      }
    }

    const actorUserId =
      opts.actorUserId ?? (await resolveOperatorUserId(db, t.organization_id));
    if (!actorUserId) {
      skipped += 1;
      continue;
    }

    const tz = t.timezone ?? "UTC";
    const after = new Date();
    const next =
      computeNextRunIso(t.cron_expression, tz, after) ??
      new Date(after.getTime() + 60 * 60 * 1000).toISOString();

    try {
      const run = await createPendingRun(db, {
        organizationId: t.organization_id,
        agentId: t.agent_id,
        campaignId: t.campaign_id,
        input: { ...t.payload, _scheduledTaskId: t.id, trace_id: `trace_sched_${t.id}_${Date.now()}` },
        templateId: null,
        actorUserId,
      });

      const runId = (run as { id: string }).id;
      await executePendingRun(db, {
        organizationId: t.organization_id,
        runId,
        actorUserId,
      });

      await db
        .from("agent_scheduled_tasks" as never)
        .update({
          last_run_at: after.toISOString(),
          last_agent_run_id: runId,
          next_run_at: next,
          failure_count: 0,
          backoff_until: null,
          last_error: null,
        } as never)
        .eq("id", t.id);

      processed += 1;
    } catch (e) {
      const failureCount = Number(t.failure_count ?? 0) + 1;
      const backoffMins = computeBackoffMinutes(failureCount);
      const until = new Date(Date.now() + backoffMins * 60_000).toISOString();

      await db
        .from("agent_scheduled_tasks" as never)
        .update({
          failure_count: failureCount,
          backoff_until: until,
          last_error: e instanceof Error ? e.message : "Run failed",
          next_run_at: next,
        } as never)
        .eq("id", t.id);

      skipped += 1;
    }
  }

  return { processed, skipped };
}
