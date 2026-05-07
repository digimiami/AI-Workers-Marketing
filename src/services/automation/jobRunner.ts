import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/errors";
import { generateContentBatch, scheduleContentPosting, contentPublisherWorker } from "@/services/automation/contentEngine";
import { autoLaunchAds, autoOptimizeCampaigns, scaleWinners } from "@/services/automation/adsAutoEngine";
import { computeCampaignMetrics } from "@/services/analytics/metricsEngine";

function workerId() {
  return `auto_${process.pid}_${Date.now()}`;
}

export async function enqueueAutomationJob(input: {
  organizationId: string;
  campaignId?: string | null;
  userId?: string | null;
  type: string;
  payload?: Record<string, unknown>;
  runAfter?: Date;
  priority?: number;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("jobs" as never)
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId ?? null,
      campaign_id: input.campaignId ?? null,
      type: input.type,
      status: "queued",
      priority: input.priority ?? 100,
      payload: input.payload ?? {},
      run_after: input.runAfter?.toISOString() ?? null,
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to enqueue job");
  return String((data as any).id);
}

async function runJob(row: any) {
  const type = String(row.type);
  const payload = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<string, unknown>;
  const organizationId = String(row.organization_id);
  const campaignId = row.campaign_id ? String(row.campaign_id) : typeof payload.campaignId === "string" ? String(payload.campaignId) : null;

  if (type === "content_generation") {
    if (!campaignId) throw new Error("campaignId required");
    const campaignName = String(payload.campaignName ?? "Growth campaign");
    const goal = String(payload.goal ?? "Generate qualified leads");
    const audience = String(payload.audience ?? "Target buyers");
    const ctaLink = String(payload.ctaLink ?? `/f/${campaignId}`);
    const batch = await generateContentBatch({ organizationId, campaignId, campaignName, goal, audience, ctaLink });
    const scheduled = await scheduleContentPosting({
      organizationId,
      campaignId,
      userId: row.user_id ? String(row.user_id) : null,
      posts: batch.posts,
    });
    return { generated: batch.posts.length, scheduled: scheduled.scheduled.length, meta: batch.meta };
  }

  if (type === "content_publisher_worker") return contentPublisherWorker({ organizationId, limit: Number(payload.limit ?? 50) });
  if (type === "ads_auto_launch") return autoLaunchAds({ organizationId, limit: Number(payload.limit ?? 50) });
  if (type === "optimize_campaigns") return autoOptimizeCampaigns({ organizationId, limit: Number(payload.limit ?? 50) });
  if (type === "scale_winners") return scaleWinners({ organizationId, limit: Number(payload.limit ?? 50) });
  if (type === "metrics_rollup") return computeCampaignMetrics({ organizationId, campaignId });

  throw new Error(`Unknown job type: ${type}`);
}

export async function processAutomationJobs(input: { organizationId?: string; limit?: number }) {
  const admin = createSupabaseAdminClient();
  const id = workerId();
  let q = admin
    .from("jobs" as never)
    .select("id,organization_id,user_id,campaign_id,type,payload,attempts,max_attempts")
    .eq("status", "queued")
    .or(`run_after.is.null,run_after.lte.${new Date().toISOString()}`)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(input.limit ?? 20);
  if (input.organizationId) q = q.eq("organization_id", input.organizationId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const results: Array<Record<string, unknown>> = [];
  for (const row of (data ?? []) as any[]) {
    const jobId = String(row.id);
    const now = new Date().toISOString();
    await admin
      .from("jobs" as never)
      .update({ status: "running", locked_at: now, locked_by: id, attempts: Number(row.attempts ?? 0) + 1, updated_at: now } as never)
      .eq("id", jobId)
      .eq("status", "queued");

    try {
      const result = await runJob(row);
      await admin
        .from("jobs" as never)
        .update({ status: "succeeded", result, processed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
        .eq("id", jobId);
      results.push({ jobId, status: "succeeded", result });
    } catch (e) {
      const attempts = Number(row.attempts ?? 0) + 1;
      const max = Number(row.max_attempts ?? 3);
      const failed = attempts >= max;
      const message = e instanceof Error ? e.message : "Job failed";
      await logError({
        organizationId: String(row.organization_id),
        userId: row.user_id ? String(row.user_id) : null,
        campaignId: row.campaign_id ? String(row.campaign_id) : null,
        category: "job",
        message,
        context: { job_id: jobId, job_type: row.type, attempts, failed },
      });
      await admin
        .from("jobs" as never)
        .update({
          status: failed ? "failed" : "queued",
          error_message: message,
          run_after: failed ? null : new Date(Date.now() + attempts * 5 * 60_000).toISOString(),
          processed_at: failed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", jobId);
      results.push({ jobId, status: failed ? "failed" : "queued", error: message });
    }
  }

  return { processed: (data ?? []).length, results };
}

