import type { SupabaseClient } from "@supabase/supabase-js";

import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";
import type { AiPlan, RunAiMarketingAgentInput, RunAiMarketingAgentOutput } from "@/services/ai-agent/types";
import { provisionAiWorkersWorkspace } from "@/services/workspace/provisionAiWorkersWorkspace";
import { syncAgentsAndTemplates } from "@/services/openclaw/orchestrationService";

type Db = SupabaseClient;

async function insertAgentLog(
  db: Db,
  row: { organization_id: string; run_id: string; level: string; message: string; data?: Record<string, unknown> },
) {
  await db.from("agent_logs" as never).insert({
    organization_id: row.organization_id,
    run_id: row.run_id,
    level: row.level,
    message: row.message,
    data: row.data ?? {},
  } as never);
}

async function insertAgentOutput(
  db: Db,
  row: { organization_id: string; run_id: string; output_type: string; content: Record<string, unknown> },
) {
  await db.from("agent_outputs" as never).insert({
    organization_id: row.organization_id,
    run_id: row.run_id,
    output_type: row.output_type,
    content: row.content ?? {},
  } as never);
}

async function listApprovalsForRun(db: Db, organizationId: string, runId: string) {
  const { data } = await db
    .from("approvals" as never)
    .select("id,status,approval_type")
    .eq("organization_id", organizationId)
    .eq("agent_run_id", runId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Array<{ id: string; status: string; approval_type: string }>;
}

function inferCampaignName(input: RunAiMarketingAgentInput) {
  const host = (() => {
    try {
      return input.url ? new URL(input.url).host : "";
    } catch {
      return "";
    }
  })();
  const parts = [
    input.campaignType ? input.campaignType.toUpperCase() : "CAMPAIGN",
    host || input.niche || "Draft",
  ].filter(Boolean);
  return parts.join(" · ").slice(0, 80);
}

async function getOrCreateLauncherAgentId(db: Db, organizationId: string) {
  // Ensure registry-backed agents exist for this org, then fetch campaign_launcher id.
  await syncAgentsAndTemplates(db as any, organizationId);
  const { data } = await db
    .from("agents" as never)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("key", "campaign_launcher")
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function executeInternalPlan(params: {
  db: Db;
  runId: string;
  input: RunAiMarketingAgentInput;
  plan: AiPlan;
}): Promise<Omit<RunAiMarketingAgentOutput, "runId" | "plan">> {
  const { db, runId, input, plan } = params;
  const warnings: string[] = [];
  const errors: string[] = [];
  const createdRecords: Record<string, unknown> = {};
  const updatedRecords: Record<string, unknown> = {};
  const logs: RunAiMarketingAgentOutput["logs"] = [];

  const log = async (level: string, message: string, data?: Record<string, unknown>) => {
    logs.push({ level, message, data });
    await insertAgentLog(db, {
      organization_id: input.organizationId,
      run_id: runId,
      level,
      message,
      data,
    });
  };

  await log("info", "AI Command Center: execution started", { provider: "internal_llm", mode: input.mode });
  await insertAgentOutput(db, {
    organization_id: input.organizationId,
    run_id: runId,
    output_type: "ai.plan",
    content: plan as unknown as Record<string, unknown>,
  });

  if (input.approvalMode === "required") {
    await log("warn", "approvalMode=required: execution will only create a plan output");
    return {
      createdRecords,
      updatedRecords,
      approvalItems: await listApprovalsForRun(db, input.organizationId, runId),
      logs,
      warnings: ["approvalMode=required is set; execution skipped (plan only)."],
      errors,
    };
  }

  if (input.mode !== "create_campaign") {
    await log("warn", "Mode not implemented in internal stub executor", { mode: input.mode });
    return {
      createdRecords,
      updatedRecords,
      approvalItems: await listApprovalsForRun(db, input.organizationId, runId),
      logs,
      warnings: ["Selected mode is stubbed for internal provider; plan created but no actions executed."],
      errors,
    };
  }

  // Full "OS bootstrap" execution: reuse the proven workspace provisioning pipeline.
  // This creates Campaign, Funnel+steps, Content assets, Email templates+sequence, Tracking, Approvals, Logs.
  const traceId = `ai_cmd_${runId}`.slice(0, 120);

  try {
    await log("info", "Starting full workspace provisioning (creates funnel/content/email/etc)");

    const launcherAgentId = await getOrCreateLauncherAgentId(db, input.organizationId);
    if (!launcherAgentId) throw new Error("Missing campaign_launcher agent after sync");

    const isClient = (input.campaignType ?? "").toLowerCase().includes("client");
    const provision = await provisionAiWorkersWorkspace({
      actorUserId: input.userId,
      organizationId: input.organizationId,
      launcherAgentId,
      masterRunId: runId,
      traceId,
      input: {
        mode: isClient ? "client" : "affiliate",
        organizationMode: "existing",
        organizationId: input.organizationId,
        affiliateLink: !isClient ? input.url : undefined,
        clientWebsite: isClient ? input.url : undefined,
        businessName: isClient ? (input.niche ?? "Client") : undefined,
        niche: input.niche ?? "general",
        audience: input.audience ?? "general audience",
        trafficSource: input.trafficSource ?? "tiktok",
        goal: input.goal,
        notes: input.notes,
        devSeedDemoData: false,
      },
    });

    createdRecords.provisioning = provision as any;
    updatedRecords.campaign_id = provision.campaignId ?? null;
    updatedRecords.funnel_id = provision.funnelId ?? null;
    updatedRecords.email_sequence_id = provision.emailSequenceId ?? null;

    await insertAgentOutput(db, {
      organization_id: input.organizationId,
      run_id: runId,
      output_type: "ai.artifacts",
      content: { createdRecords, updatedRecords, warnings } as any,
    });

    await log("info", "Execution finished");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    errors.push(msg);
    await log("error", "Execution failed", { error: msg });
  }

  const approvalItems = await listApprovalsForRun(db, input.organizationId, runId);
  return { createdRecords, updatedRecords, approvalItems, logs, warnings, errors };
}

