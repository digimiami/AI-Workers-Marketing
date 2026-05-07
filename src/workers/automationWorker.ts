import { processAutomationJobs } from "@/services/automation/jobRunner";
import { contentPublisherWorker } from "@/services/automation/contentEngine";
import { autoLaunchAds, autoOptimizeCampaigns, scaleWinners } from "@/services/automation/adsAutoEngine";

/**
 * Worker entrypoint for optional external worker service.
 * Vercel Cron uses the API route; a long-running worker can import this function directly.
 */
export async function runAutomationWorkerOnce(input: { organizationId?: string; limit?: number } = {}) {
  const [jobs, content, ads, optimize, scale] = await Promise.all([
    processAutomationJobs({ organizationId: input.organizationId, limit: input.limit ?? 20 }),
    contentPublisherWorker({ organizationId: input.organizationId, limit: input.limit ?? 50 }),
    autoLaunchAds({ organizationId: input.organizationId, limit: input.limit ?? 50 }),
    autoOptimizeCampaigns({ organizationId: input.organizationId, limit: input.limit ?? 50 }),
    scaleWinners({ organizationId: input.organizationId, limit: input.limit ?? 50 }),
  ]);
  return { jobs, content, ads, optimize, scale };
}

