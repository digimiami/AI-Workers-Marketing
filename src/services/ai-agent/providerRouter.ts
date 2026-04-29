import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiPlan, RunAiMarketingAgentInput, RunAiMarketingAgentOutput } from "@/services/ai-agent/types";
import { executeInternalPlan } from "@/services/ai-agent/agentExecutor";
import { buildAiPlan } from "@/services/ai-agent/agentPlanner";
import { planWithInternalLlm } from "@/services/ai-agent/internalLlmProvider";
import { createPendingRun, executePendingRun, syncAgentsAndTemplates } from "@/services/openclaw/orchestrationService";

type Db = SupabaseClient;

async function getAgentIdByKey(db: Db, organizationId: string, key: string) {
  const { data } = await db
    .from("agents" as never)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("key", key)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function planOnly(input: RunAiMarketingAgentInput): Promise<AiPlan> {
  const plannerInput = {
    provider: input.provider,
    mode: input.mode,
    url: input.url,
    campaignId: input.campaignId,
    goal: input.goal,
    niche: input.niche,
    audience: input.audience,
    trafficSource: input.trafficSource,
    campaignType: input.campaignType,
    notes: input.notes,
    approvalMode: input.approvalMode,
  };

  if (input.provider === "internal_llm" || input.provider === "hybrid") {
    return planWithInternalLlm(plannerInput);
  }

  return buildAiPlan(plannerInput);
}

export async function routeAndRun(params: {
  db: Db;
  input: RunAiMarketingAgentInput;
  plan: AiPlan;
}): Promise<RunAiMarketingAgentOutput> {
  const { db, input, plan } = params;

  // Ensure agent registry is synced so we can create runs against a stable agent row.
  await syncAgentsAndTemplates(db as any, input.organizationId);

  const agentKey =
    input.provider === "openclaw"
      ? "campaign_launcher"
      : input.provider === "internal_llm"
        ? "campaign_launcher"
        : "campaign_launcher";

  const agentId = (await getAgentIdByKey(db, input.organizationId, agentKey)) ?? "";
  if (!agentId) throw new Error(`Agent not found after sync: ${agentKey}`);

  // Create an agent_run for observability in the existing admin UI.
  const run = await createPendingRun(db as any, {
    organizationId: input.organizationId,
    agentId,
    campaignId: input.campaignId ?? null,
    input: {
      ai_command: true,
      provider: input.provider,
      mode: input.mode,
      url: input.url ?? null,
      goal: input.goal,
      niche: input.niche ?? null,
      audience: input.audience ?? null,
      trafficSource: input.trafficSource ?? null,
      notes: input.notes ?? null,
      approvalMode: input.approvalMode,
      plan,
    } as any,
    templateId: null,
    actorUserId: input.userId,
  });

  const runId = (run as { id: string }).id;

  if (input.provider === "openclaw") {
    // Delegate to OpenClaw provider run (stub/live); outputs stored in agent_outputs by orchestrationService.
    const exec = await executePendingRun(db as any, {
      organizationId: input.organizationId,
      runId,
      actorUserId: input.userId,
    });
    return {
      runId,
      plan,
      createdRecords: {},
      updatedRecords: {},
      approvalItems: [],
      logs: [{ level: exec.ok ? "info" : "error", message: "OpenClaw provider completed", data: { ok: exec.ok } }],
      warnings: [],
      errors: exec.ok ? [] : ["OpenClaw run failed"],
    };
  }

  if (input.provider === "internal_llm") {
    const out = await executeInternalPlan({ db, runId, input, plan });
    return { runId, plan, ...out };
  }

  // Hybrid: internal executes drafts, OpenClaw can validate via provider outputs (optional).
  const internalOut = await executeInternalPlan({ db, runId, input, plan });
  return {
    runId,
    plan,
    createdRecords: internalOut.createdRecords,
    updatedRecords: internalOut.updatedRecords,
    approvalItems: internalOut.approvalItems,
    logs: internalOut.logs,
    warnings: internalOut.warnings,
    errors: internalOut.errors,
  };
}

