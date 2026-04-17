import type { SupabaseClient } from "@supabase/supabase-js";

import { computeNextRunIso } from "@/lib/cron/nextRun";
import {
  createPendingRun,
  executePendingRun,
} from "@/services/openclaw/orchestrationService";

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
    };

    const actorUserId =
      opts.actorUserId ?? (await resolveOperatorUserId(db, t.organization_id));
    if (!actorUserId) {
      skipped += 1;
      continue;
    }

    const run = await createPendingRun(db, {
      organizationId: t.organization_id,
      agentId: t.agent_id,
      campaignId: t.campaign_id,
      input: { ...t.payload, _scheduledTaskId: t.id },
      templateId: null,
      actorUserId,
    });

    const runId = (run as { id: string }).id;
    await executePendingRun(db, {
      organizationId: t.organization_id,
      runId,
      actorUserId,
    });

    const tz = t.timezone ?? "UTC";
    const after = new Date();
    const next =
      computeNextRunIso(t.cron_expression, tz, after) ??
      new Date(after.getTime() + 60 * 60 * 1000).toISOString();

    await db
      .from("agent_scheduled_tasks" as never)
      .update({
        last_run_at: after.toISOString(),
        last_agent_run_id: runId,
        next_run_at: next,
      } as never)
      .eq("id", t.id);

    processed += 1;
  }

  return { processed, skipped };
}
