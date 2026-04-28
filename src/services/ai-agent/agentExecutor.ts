import type { SupabaseClient } from "@supabase/supabase-js";

import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";
import type { AiPlan, RunAiMarketingAgentInput, RunAiMarketingAgentOutput } from "@/services/ai-agent/types";

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

  // Use tool layer to create drafts. This ensures org ownership validation + tool-call logs.
  const traceId = `ai_cmd_${runId}`.slice(0, 120);
  const callTool = async (tool_name: string, toolInput: Record<string, unknown>) => {
    const env = {
      organization_id: input.organizationId,
      trace_id: traceId,
      role_mode: "supervisor",
      approval_mode: "auto",
      tool_name,
      actor: { type: "user", user_id: input.userId },
      campaign_id: input.campaignId ?? null,
      run_id: runId,
      input: toolInput,
    };
    const r = await executeOpenClawTool(env);
    if (!r.success) {
      throw new Error(`${tool_name}: ${r.error.code} ${r.error.message}`);
    }
    return r.data as Record<string, unknown>;
  };

  try {
    await log("info", "Logging analytics event", { event: "ai_command.plan_executing" });
    await callTool("log_analytics_event", {
      organizationId: input.organizationId,
      event_name: "ai_command.plan_executing",
      source: "ai_command_center",
      campaign_id: input.campaignId ?? null,
      metadata: { provider: "internal_llm", mode: input.mode },
    });

    await log("info", "Creating campaign draft");
    const campaign = await callTool("create_campaign", {
      organizationId: input.organizationId,
      name: inferCampaignName(input),
      type: input.campaignType ?? "affiliate",
      status: "draft",
      target_audience: input.audience ?? null,
      description: input.goal,
      metadata: {
        funnel: {
          url: input.url ?? null,
          goal: input.goal,
          audience: input.audience ?? null,
          traffic_source: input.trafficSource ?? null,
          niche: input.niche ?? null,
          notes: input.notes ?? null,
        },
        ads: {
          traffic_source: input.trafficSource ?? null,
          audience: input.audience ?? null,
        },
        emails: {
          audience: input.audience ?? null,
          goal: input.goal,
        },
      },
    });
    createdRecords.campaign = campaign;
    const campaignId = String(campaign.id ?? "");
    if (campaignId) {
      updatedRecords.campaign_id = campaignId;
    } else {
      warnings.push("create_campaign did not return an id");
    }

    if (campaignId) {
      await log("info", "Creating funnel draft");
      const funnel = await callTool("create_funnel", {
        organizationId: input.organizationId,
        name: "Funnel · Draft",
        campaign_id: campaignId,
        status: "draft",
        metadata: { source_url: input.url ?? null },
      });
      createdRecords.funnel = funnel;

      const funnelId = String(funnel.id ?? "");
      if (funnelId) {
        await log("info", "Adding funnel steps");
        const step1 = await callTool("add_funnel_step", {
          organizationId: input.organizationId,
          funnel_id: funnelId,
          name: "Landing",
          step_type: "landing",
          slug: "landing",
          metadata: { goal: input.goal },
        });
        const step2 = await callTool("add_funnel_step", {
          organizationId: input.organizationId,
          funnel_id: funnelId,
          name: "Bridge",
          step_type: "bridge",
          slug: "bridge",
          metadata: { goal: input.goal },
        });
        createdRecords.funnel_steps = [step1, step2];
      }
    }

    // Tracking link creation is high-risk in some orgs; tool layer will gate via approvals if configured.
    if (input.url) {
      await log("info", "Creating tracking link (may require approval)");
      try {
        const link = await callTool("create_tracking_link", {
          organizationId: input.organizationId,
          destination_url: input.url,
          label: `AI Command · ${input.trafficSource ?? "traffic"}`.slice(0, 80),
          campaign_id: (updatedRecords.campaign_id as string | undefined) ?? null,
          utm_defaults: {
            utm_source: (input.trafficSource ?? "").toLowerCase().slice(0, 32) || "ai",
            utm_campaign: "ai-command",
          },
        });
        createdRecords.tracking_link = link;
      } catch (e) {
        warnings.push(e instanceof Error ? e.message : "create_tracking_link failed");
      }
    }

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

