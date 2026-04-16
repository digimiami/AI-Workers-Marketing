import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createPendingRun,
  executePendingRun,
} from "@/services/openclaw/orchestrationService";

/**
 * Queue-friendly runner: find due schedules and enqueue agent runs.
 * Wire to Vercel Cron (`/api/cron/agent-schedules`) or an external worker.
 * TODO: parse cron_expression (e.g. node-cron / croner) to compute accurate next_run_at.
 */
export async function processDueAgentSchedules(
  db: SupabaseClient,
  opts: { organizationId?: string; actorUserId: string; limit?: number },
): Promise<{ processed: number }> {
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
  for (const task of tasks ?? []) {
    const t = task as {
      id: string;
      organization_id: string;
      agent_id: string;
      campaign_id: string | null;
      payload: Record<string, unknown>;
    };

    const run = await createPendingRun(db, {
      organizationId: t.organization_id,
      agentId: t.agent_id,
      campaignId: t.campaign_id,
      input: { ...t.payload, _scheduledTaskId: t.id },
      templateId: null,
      actorUserId: opts.actorUserId,
    });

    const runId = (run as { id: string }).id;
    await executePendingRun(db, {
      organizationId: t.organization_id,
      runId,
      actorUserId: opts.actorUserId,
    });

    await db
      .from("agent_scheduled_tasks" as never)
      .update({
        last_run_at: new Date().toISOString(),
        last_agent_run_id: runId,
        next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      } as never)
      .eq("id", t.id);

    processed += 1;
  }

  return { processed };
}
