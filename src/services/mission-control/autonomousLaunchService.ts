import type { SupabaseClient } from "@supabase/supabase-js";

import {
  beginMarketingPipelineRun,
  runMarketingPipeline,
} from "@/services/marketing-pipeline/runMarketingPipeline";
import type { RunMarketingPipelineInput } from "@/services/marketing-pipeline/types";

import { normalizeWebsiteUrl, type MissionControlIntake } from "./intakeService";

export function shouldStartAutonomousBuild(params: {
  intake: MissionControlIntake;
  message: string;
  intent: string;
}): boolean {
  const { intake, message, intent } = params;
  const actionable = [
    "create_campaign",
    "build_funnel",
    "create_ads",
    "lead_generation_playbook",
    "build_landing_page",
    "launch_campaign",
  ].includes(intent);

  if (!actionable) return false;
  if (intake.websiteUrl) return true;
  const kw = intake.keywords ?? [];
  if (kw.length >= 2 && intake.goal) return true;
  return false;
}

export function buildPipelineInputFromIntake(
  intake: MissionControlIntake,
  organizationId: string,
): RunMarketingPipelineInput {
  const url = intake.websiteUrl ? normalizeWebsiteUrl(intake.websiteUrl) : "https://example.com";
  const trafficSource =
    intake.trafficSource && intake.trafficSource !== "unknown"
      ? intake.trafficSource === "google"
        ? "google"
        : intake.trafficSource === "meta"
          ? "meta"
          : intake.trafficSource
      : intake.goal?.includes("consultation") || intake.goal?.includes("schedule")
        ? "google"
        : "google";

  const audience =
    intake.audience?.trim() ||
    (intake.location
      ? `Customers in ${intake.location} matching the business offer`
      : "Target customers identified from website research and offer positioning");

  const notes = [
    intake.keywords?.length ? `Keywords: ${intake.keywords.join(", ")}` : null,
    intake.budgetText ? `Budget note: ${intake.budgetText}` : null,
    intake.businessType ? `Business: ${intake.businessType}` : null,
    "Autonomous Mission Control launch",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    organizationMode: "existing",
    organizationId,
    url,
    mode: "client",
    goal: intake.goal?.trim() || "generate leads",
    audience,
    trafficSource,
    notes: notes || undefined,
    provider: "hybrid",
    approvalMode: "auto_draft",
    defer: true,
  };
}

export async function beginAutonomousPipelineBuild(params: {
  db: SupabaseClient;
  actorUserId: string;
  organizationId: string;
  intake: MissionControlIntake;
}) {
  const input = buildPipelineInputFromIntake(params.intake, params.organizationId);
  const begin = await beginMarketingPipelineRun({
    supabase: params.db,
    actorUserId: params.actorUserId,
    input,
  });

  const workspaceUrl = `/admin/workspace/${begin.pipelineRunId}`;

  return {
    pipelineRunId: begin.pipelineRunId,
    campaignId: null as string | null,
    workspaceUrl,
    resumeInput: {
      resumePipelineRunId: begin.pipelineRunId,
      organizationMode: "existing" as const,
      organizationId: params.organizationId,
    } as RunMarketingPipelineInput,
  };
}

export async function continueDeferredPipelineBuild(params: {
  db: SupabaseClient;
  actorUserId: string;
  resumeInput: Pick<RunMarketingPipelineInput, "resumePipelineRunId" | "organizationMode" | "organizationId">;
}) {
  return runMarketingPipeline({
    supabase: params.db,
    actorUserId: params.actorUserId,
    input: params.resumeInput as RunMarketingPipelineInput,
  });
}
