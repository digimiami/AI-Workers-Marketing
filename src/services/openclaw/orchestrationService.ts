import type { SupabaseClient } from "@supabase/supabase-js";

import { computeNextRunIso } from "@/lib/cron/nextRun";
import { getOpenClawProvider } from "@/lib/openclaw/factory";
import { getRegistryEntry, OPENCLAW_AGENT_REGISTRY } from "@/lib/openclaw/registry";
import type { ExecuteContext, OpenClawRunStatus, RunHumanGate } from "@/lib/openclaw/types";
import { writeAuditLog } from "@/services/audit/auditService";
import { dispatchWorkflow } from "@/services/github/githubActionsService";
import { env } from "@/lib/env";
import { launchPaidAdsAfterApprovals } from "@/services/ads/adsEngine";
import { applyDeferredToolAfterApproval } from "@/services/openclaw/deferredToolApproval";

type Db = SupabaseClient;

async function insertLog(
  db: Db,
  row: {
    organization_id: string;
    run_id: string;
    level: string;
    message: string;
    data?: Record<string, unknown>;
  },
) {
  await db.from("agent_logs" as never).insert({
    organization_id: row.organization_id,
    run_id: row.run_id,
    level: row.level,
    message: row.message,
    data: row.data ?? {},
  } as never);
}

export async function syncAgentsAndTemplates(db: Db, organizationId: string) {
  for (const def of OPENCLAW_AGENT_REGISTRY) {
    const { data: agent, error } = await db
      .from("agents" as never)
      .upsert(
        {
          organization_id: organizationId,
          key: def.key,
          name: def.name,
          description: def.description,
          status: "enabled",
          approval_required: def.defaultApprovalRequired,
          allowed_tools: def.allowedTools,
          input_schema: def.inputSchema,
          output_schema: def.outputSchema,
        } as never,
        { onConflict: "organization_id,key" },
      )
      .select("id")
      .single();

    if (error || !agent) continue;

    const agentId = (agent as { id: string }).id;

    const { data: existingTpl } = await db
      .from("agent_templates" as never)
      .select("id")
      .eq("agent_id", agentId)
      .eq("is_default", true)
      .maybeSingle();

    if (!existingTpl) {
      await db.from("agent_templates" as never).insert({
        organization_id: organizationId,
        agent_id: agentId,
        name: "Default",
        system_prompt: def.defaultSystemPrompt,
        style_rules: def.defaultStyleRules,
        forbidden_claims: def.defaultForbiddenClaims,
        output_format: def.defaultOutputFormat,
        is_default: true,
        version: 1,
      } as never);
    }
  }
}

export async function listAgents(db: Db, organizationId: string) {
  const { data, error } = await db
    .from("agents" as never)
    .select(
      "id,key,name,description,status,approval_required,last_run_at,created_at,agent_templates(id,name,is_default,version)",
    )
    .eq("organization_id", organizationId)
    .order("key", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateAgent(
  db: Db,
  organizationId: string,
  agentId: string,
  patch: { status?: "enabled" | "disabled"; approval_required?: boolean },
) {
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;
  const { data, error } = await db
    .from("agents" as never)
    .update(clean as never)
    .eq("id", agentId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listTemplates(db: Db, organizationId: string, agentId: string) {
  const { data, error } = await db
    .from("agent_templates" as never)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("agent_id", agentId)
    .order("is_default", { ascending: false })
    .order("version", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertTemplate(
  db: Db,
  organizationId: string,
  agentId: string,
  body: {
    id?: string;
    name: string;
    system_prompt: string;
    style_rules?: string | null;
    forbidden_claims?: string | null;
    output_format?: string | null;
    campaign_context?: string | null;
    is_default?: boolean;
  },
) {
  if (body.is_default) {
    await db
      .from("agent_templates" as never)
      .update({ is_default: false } as never)
      .eq("agent_id", agentId)
      .eq("organization_id", organizationId);
  }

  if (body.id) {
    const { data, error } = await db
      .from("agent_templates" as never)
      .update({
        name: body.name,
        system_prompt: body.system_prompt,
        style_rules: body.style_rules ?? null,
        forbidden_claims: body.forbidden_claims ?? null,
        output_format: body.output_format ?? null,
        campaign_context: body.campaign_context ?? null,
        is_default: body.is_default ?? false,
      } as never)
      .eq("id", body.id)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await db
    .from("agent_templates" as never)
    .insert({
      organization_id: organizationId,
      agent_id: agentId,
      name: body.name,
      system_prompt: body.system_prompt,
      style_rules: body.style_rules ?? null,
      forbidden_claims: body.forbidden_claims ?? null,
      output_format: body.output_format ?? null,
      campaign_context: body.campaign_context ?? null,
      is_default: body.is_default ?? false,
      version: 1,
    } as never)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createPendingRun(
  db: Db,
  params: {
    organizationId: string;
    agentId: string;
    campaignId?: string | null;
    input: Record<string, unknown>;
    templateId?: string | null;
    actorUserId: string;
  },
) {
  const { data, error } = await db
    .from("agent_runs" as never)
    .insert({
      organization_id: params.organizationId,
      agent_id: params.agentId,
      campaign_id: params.campaignId ?? null,
      status: "pending" as OpenClawRunStatus,
      input: params.input,
      template_id: params.templateId ?? null,
    } as never)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    action: "agent.run",
    entityType: "agent_run",
    entityId: (data as { id: string }).id,
    metadata: { agent_id: params.agentId },
  });

  return data;
}

async function loadMemoryMap(db: Db, organizationId: string, agentId: string) {
  const { data } = await db
    .from("agent_memory" as never)
    .select("key,value")
    .eq("organization_id", organizationId)
    .eq("agent_id", agentId);

  const mem: Record<string, unknown> = {};
  for (const row of data ?? []) {
    const r = row as { key: string; value: unknown };
    mem[r.key] = r.value;
  }
  return mem;
}

async function loadPriorOutputs(db: Db, organizationId: string, agentId: string) {
  const { data: runs } = await db
    .from("agent_runs" as never)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("agent_id", agentId)
    .in("status", ["success", "approved"])
    .order("created_at", { ascending: false })
    .limit(5);

  const runIds = (runs ?? []).map((r: { id: string }) => r.id);
  if (runIds.length === 0) return [];

  const { data: outs } = await db
    .from("agent_outputs" as never)
    .select("run_id,output_type,content")
    .eq("organization_id", organizationId)
    .in("run_id", runIds)
    .order("created_at", { ascending: false })
    .limit(25);

  return (outs ?? []).map((o: { run_id: string; output_type: string; content: unknown }) => ({
    runId: o.run_id,
    outputType: o.output_type,
    content: (o.content ?? {}) as Record<string, unknown>,
  }));
}

export async function executePendingRun(
  db: Db,
  params: { organizationId: string; runId: string; actorUserId: string },
) {
  const { data: run, error: runErr } = await db
    .from("agent_runs" as never)
    .select("*, agents(*)")
    .eq("id", params.runId)
    .eq("organization_id", params.organizationId)
    .single();

  if (runErr || !run) throw new Error(runErr?.message ?? "Run not found");

  const agent = (run as { agents: Record<string, unknown> }).agents as {
    id: string;
    key: string;
    name: string;
    approval_required: boolean;
  };

  await db
    .from("agent_runs" as never)
    .update({ status: "running", started_at: new Date().toISOString() } as never)
    .eq("id", params.runId);

  await insertLog(db, {
    organization_id: params.organizationId,
    run_id: params.runId,
    level: "info",
    message: "Run started",
    data: { provider: getOpenClawProvider().id },
  });

  let template: Record<string, unknown> | null = null;
  const templateId = (run as { template_id?: string | null }).template_id;
  if (templateId) {
    const { data: t } = await db
      .from("agent_templates" as never)
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    template = t ? (t as Record<string, unknown>) : null;
  }
  if (!template) {
    const { data: t } = await db
      .from("agent_templates" as never)
      .select("*")
      .eq("agent_id", agent.id)
      .eq("is_default", true)
      .maybeSingle();
    template = t ? (t as Record<string, unknown>) : null;
  }

  const reg = getRegistryEntry(agent.key);
  const systemPrompt =
    (template?.system_prompt as string) ?? reg?.defaultSystemPrompt ?? "You are a helpful agent.";
  const styleRules = (template?.style_rules as string | null) ?? reg?.defaultStyleRules ?? null;
  const forbiddenClaims =
    (template?.forbidden_claims as string | null) ?? reg?.defaultForbiddenClaims ?? null;
  const outputFormat =
    (template?.output_format as string | null) ?? reg?.defaultOutputFormat ?? null;

  const memory = await loadMemoryMap(db, params.organizationId, agent.id);
  const priorOutputs = await loadPriorOutputs(db, params.organizationId, agent.id);

  const ctx: ExecuteContext = {
    runId: params.runId,
    organizationId: params.organizationId,
    campaignId: (run as { campaign_id: string | null }).campaign_id,
    actorUserId: params.actorUserId,
    traceId:
      String(((run as { input?: any }).input as any)?.trace_id ?? "") || `trace_${params.runId}`,
    agentKey: agent.key,
    agentName: agent.name,
    systemPrompt,
    styleRules,
    forbiddenClaims,
    outputFormat,
    input: ((run as { input: unknown }).input ?? {}) as Record<string, unknown>,
    memory,
    priorOutputs,
  };

  const provider = getOpenClawProvider();
  const result = await provider.executeRun(ctx);

  await insertLog(db, {
    organization_id: params.organizationId,
    run_id: params.runId,
    level: result.ok ? "info" : "error",
    message: result.ok ? "Provider finished" : "Provider error",
    data: { raw: result.raw },
  });

  if (!result.ok) {
    await db
      .from("agent_runs" as never)
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: result.errorMessage ?? "Unknown error",
        output_summary: null,
      } as never)
      .eq("id", params.runId);
    return { ok: false as const, runId: params.runId };
  }

  const outputs = result.structuredOutputs ?? [
    { outputType: "openclaw.empty", content: { note: "No structured outputs returned" } },
  ];

  for (const o of outputs) {
    await db.from("agent_outputs" as never).insert({
      organization_id: params.organizationId,
      run_id: params.runId,
      output_type: o.outputType,
      content: o.content,
    } as never);
  }

  await db.from("agent_memory" as never).upsert(
    {
      organization_id: params.organizationId,
      agent_id: agent.id,
      key: "last_successful_run",
      value: {
        runId: params.runId,
        at: new Date().toISOString(),
        summary: result.summary ?? null,
        outputTypes: outputs.map((x) => x.outputType),
      },
    } as never,
    { onConflict: "agent_id,key" },
  );

  await db
    .from("agents" as never)
    .update({ last_run_at: new Date().toISOString() } as never)
    .eq("id", agent.id);

  await db
    .from("agent_runs" as never)
    .update({
      status: "success",
      finished_at: new Date().toISOString(),
      output_summary: result.summary ?? null,
      error_message: null,
    } as never)
    .eq("id", params.runId);

  if (agent.approval_required) {
    await db.from("approvals" as never).insert({
      organization_id: params.organizationId,
      campaign_id: (run as { campaign_id: string | null }).campaign_id,
      status: "pending",
      approval_type: "agent_output",
      reason_required: true,
      requested_by_user_id: params.actorUserId,
      agent_run_id: params.runId,
      target_entity_type: "agent_run",
      target_entity_id: params.runId,
      payload: {
        summary: result.summary ?? "",
        outputTypes: outputs.map((x) => x.outputType),
      },
    } as never);
  }

  return { ok: true as const, runId: params.runId };
}

export async function listRuns(
  db: Db,
  organizationId: string,
  filters?: { agentId?: string; status?: OpenClawRunStatus },
) {
  let q = db
    .from("agent_runs" as never)
    .select(
      "id,agent_id,campaign_id,status,output_summary,error_message,created_at,started_at,finished_at,agents(key,name)",
    )
    .eq("organization_id", organizationId);

  if (filters?.agentId) q = q.eq("agent_id", filters.agentId);
  if (filters?.status) q = q.eq("status", filters.status);

  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRunDetail(db: Db, organizationId: string, runId: string) {
  const { data, error } = await db
    .from("agent_runs" as never)
    .select("*, agents(*)")
    .eq("organization_id", organizationId)
    .eq("id", runId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getHumanGateForRun(
  db: Db,
  organizationId: string,
  runId: string,
  run: Record<string, unknown>,
): Promise<RunHumanGate> {
  const status = run.status as OpenClawRunStatus | undefined;

  if (status === "approved") {
    const { data: row } = await db
      .from("approvals" as never)
      .select("id,decided_at,decision_reason,status")
      .eq("organization_id", organizationId)
      .eq("agent_run_id", runId)
      .eq("status", "approved")
      .order("decided_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const r = row as
      | { id: string; decided_at: string | null; decision_reason: string | null }
      | null;
    return {
      phase: "approved",
      approvalId: r?.id ?? null,
      decidedAt: r?.decided_at ?? null,
      note: r?.decision_reason ?? null,
    };
  }

  if (status === "rejected") {
    const { data: row } = await db
      .from("approvals" as never)
      .select("id,decided_at,decision_reason,status")
      .eq("organization_id", organizationId)
      .eq("agent_run_id", runId)
      .eq("status", "rejected")
      .order("decided_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const r = row as
      | { id: string; decided_at: string | null; decision_reason: string | null }
      | null;
    const runReason = (run.error_message as string | null) ?? null;
    return {
      phase: "rejected",
      approvalId: r?.id ?? null,
      decidedAt: r?.decided_at ?? null,
      reason: r?.decision_reason ?? runReason,
    };
  }

  if (status !== "success") {
    return {
      phase: "not_applicable",
      message:
        status === "failed"
          ? "This run failed before outputs could be reviewed."
          : status === "running" || status === "pending"
            ? "Human review becomes available after the run finishes successfully."
            : "No human approval step applies to this run state.",
    };
  }

  const { data: pending } = await db
    .from("approvals" as never)
    .select("id,status,reason_required,payload,created_at")
    .eq("organization_id", organizationId)
    .eq("agent_run_id", runId)
    .eq("status", "pending")
    .maybeSingle();

  const p = pending as {
    id: string;
    reason_required: boolean;
    payload: Record<string, unknown> | null;
    created_at: string | null;
  } | null;

  if (p) {
    return {
      phase: "awaiting_review",
      approvalId: p.id,
      reasonRequired: Boolean(p.reason_required),
      createdAt: p.created_at,
      payload: p.payload,
    };
  }

  return {
    phase: "not_applicable",
    message:
      "This run completed without a human approval queue entry. The agent is not configured to require human sign-off, or approval was already cleared.",
  };
}

export async function listRunLogs(db: Db, organizationId: string, runId: string) {
  const { data, error } = await db
    .from("agent_logs" as never)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listRunOutputs(db: Db, organizationId: string, runId: string) {
  const { data, error } = await db
    .from("agent_outputs" as never)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function approveRun(
  db: Db,
  organizationId: string,
  runId: string,
  userId: string,
  reason?: string,
) {
  const { data: runRow, error: runErr } = await db
    .from("agent_runs" as never)
    .select("id,status")
    .eq("organization_id", organizationId)
    .eq("id", runId)
    .maybeSingle();

  if (runErr || !runRow) throw new Error("RUN_NOT_FOUND");

  const runStatus = (runRow as { status: OpenClawRunStatus }).status;
  if (runStatus === "approved") return;

  if (runStatus !== "success") {
    throw new Error("INVALID_RUN_STATE_FOR_APPROVAL");
  }

  const { data: appr } = await db
    .from("approvals" as never)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("agent_run_id", runId)
    .eq("status", "pending")
    .maybeSingle();

  if (!appr) {
    throw new Error("NO_PENDING_APPROVAL");
  }

  await db
    .from("approvals" as never)
    .update({
      status: "approved",
      decided_by_user_id: userId,
      decision_reason: reason ?? null,
      decided_at: new Date().toISOString(),
    } as never)
    .eq("id", (appr as { id: string }).id);

  await db
    .from("agent_runs" as never)
    .update({ status: "approved", finished_at: new Date().toISOString() } as never)
    .eq("id", runId)
    .eq("organization_id", organizationId);

  await writeAuditLog({
    organizationId,
    actorUserId: userId,
    action: "approval.decision",
    entityType: "agent_run",
    entityId: runId,
    metadata: { decision: "approved" },
  });
}

export async function rejectRun(
  db: Db,
  organizationId: string,
  runId: string,
  userId: string,
  reason: string,
) {
  const { data: runRow, error: runErr } = await db
    .from("agent_runs" as never)
    .select("id,status")
    .eq("organization_id", organizationId)
    .eq("id", runId)
    .maybeSingle();

  if (runErr || !runRow) throw new Error("RUN_NOT_FOUND");

  const runStatus = (runRow as { status: OpenClawRunStatus }).status;
  if (runStatus === "rejected") return;

  if (runStatus === "approved") {
    throw new Error("ALREADY_APPROVED");
  }

  if (runStatus !== "success") {
    throw new Error("INVALID_RUN_STATE_FOR_REJECTION");
  }

  const { data: appr } = await db
    .from("approvals" as never)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("agent_run_id", runId)
    .eq("status", "pending")
    .maybeSingle();

  if (!appr) {
    throw new Error("NO_PENDING_APPROVAL");
  }

  await db
    .from("approvals" as never)
    .update({
      status: "rejected",
      decided_by_user_id: userId,
      decision_reason: reason,
      decided_at: new Date().toISOString(),
    } as never)
    .eq("id", (appr as { id: string }).id);

  await db
    .from("agent_runs" as never)
    .update({
      status: "rejected",
      finished_at: new Date().toISOString(),
      error_message: reason,
    } as never)
    .eq("id", runId)
    .eq("organization_id", organizationId);

  await writeAuditLog({
    organizationId,
    actorUserId: userId,
    action: "approval.decision",
    entityType: "agent_run",
    entityId: runId,
    metadata: { decision: "rejected", reason },
  });
}

export async function listApprovals(db: Db, organizationId: string) {
  const { data, error } = await db
    .from("approvals" as never)
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function decideApproval(
  db: Db,
  organizationId: string,
  approvalId: string,
  userId: string,
  decision: "approved" | "rejected",
  reason?: string,
): Promise<{ deferred_result: Record<string, unknown> | null }> {
  const { data: row, error } = await db
    .from("approvals" as never)
    .select("*")
    .eq("id", approvalId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !row) throw new Error("Approval not found");

  const approvalStatus = (row as { status: string }).status;
  if (approvalStatus !== "pending") {
    throw new Error("APPROVAL_ALREADY_DECIDED");
  }

  await db
    .from("approvals" as never)
    .update({
      status: decision,
      decided_by_user_id: userId,
      decision_reason: reason ?? null,
      decided_at: new Date().toISOString(),
    } as never)
    .eq("id", approvalId);

  // Apply side-effects for deployment/review workflow. This never triggers outbound providers.
  const approvalType = (row as { approval_type?: string }).approval_type ?? "";
  const payload = ((row as { payload?: unknown }).payload ?? {}) as Record<string, unknown>;
  const targetEntityType =
    (row as { target_entity_type?: string | null }).target_entity_type ??
    (typeof payload.target_entity_type === "string" ? payload.target_entity_type : null);
  const targetEntityId =
    (row as { target_entity_id?: string | null }).target_entity_id ??
    (typeof payload.target_entity_id === "string" ? payload.target_entity_id : null);

  const nextReviewStatus =
    decision === "approved" ? "ready_to_deploy" : ("rejected" as const);

  const safeUpdateReviewStatus = async (
    table: "content_assets" | "email_templates" | "email_sequences" | "affiliate_links" | "funnel_steps",
    id: string,
  ) => {
    await db
      .from(table as never)
      .update({ review_status: nextReviewStatus, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", organizationId)
      .eq("id", id);
  };

  if (targetEntityType && targetEntityId) {
    if (targetEntityType === "content_asset") {
      await safeUpdateReviewStatus("content_assets", targetEntityId);
    }
    if (targetEntityType === "email_template") {
      await safeUpdateReviewStatus("email_templates", targetEntityId);
    }
    if (targetEntityType === "email_sequence") {
      await safeUpdateReviewStatus("email_sequences", targetEntityId);
    }
    if (targetEntityType === "affiliate_link") {
      await safeUpdateReviewStatus("affiliate_links", targetEntityId);
      // If explicitly approving activation, enable the link (still no outbound execution).
      if (decision === "approved" && approvalType === "affiliate_cta_activation") {
        await db
          .from("affiliate_links" as never)
          .update({ is_active: true, updated_at: new Date().toISOString() } as never)
          .eq("organization_id", organizationId)
          .eq("id", targetEntityId);
      }
    }
    if (targetEntityType === "funnel_step") {
      await safeUpdateReviewStatus("funnel_steps", targetEntityId);
    }
    if (targetEntityType === "email_log") {
      if (decision === "approved") {
        const { data: row2 } = await db
          .from("email_logs" as never)
          .select("metadata")
          .eq("organization_id", organizationId)
          .eq("id", targetEntityId)
          .maybeSingle();
        const meta = (((row2 as any)?.metadata ?? {}) as Record<string, unknown>) ?? {};
        await db
          .from("email_logs" as never)
          .update({
            next_attempt_at: new Date().toISOString(),
            error_message: null,
            metadata: { ...meta, gated: false, approved_at: new Date().toISOString() },
          } as never)
          .eq("organization_id", organizationId)
          .eq("id", targetEntityId);
      } else {
        await db
          .from("email_logs" as never)
          .update({
            status: "failed",
            error_message: reason ?? "Rejected",
            next_attempt_at: null,
          } as never)
          .eq("organization_id", organizationId)
          .eq("id", targetEntityId);
      }
    }
  }

  // Paid ads: never launches outbound providers unless explicitly approved via queue decision.
  if (decision === "approved" && approvalType === "paid_ads_launch" && targetEntityType === "ad_campaign" && targetEntityId) {
    const { data: ac } = await db
      .from("ad_campaigns" as never)
      .select("id,campaign_id,platform")
      .eq("organization_id", organizationId)
      .eq("id", targetEntityId)
      .maybeSingle();
    const campaignIdForAds = (ac as any)?.campaign_id ? String((ac as any).campaign_id) : (row as any)?.campaign_id ? String((row as any).campaign_id) : null;
    const platformRaw = String((ac as any)?.platform ?? (payload as any)?.platform ?? "meta");
    const platform = platformRaw === "google" ? "google" : "meta";
    if (campaignIdForAds) {
      await launchPaidAdsAfterApprovals({
        organizationId,
        campaignId: campaignIdForAds,
        adCampaignId: String(targetEntityId),
        platform,
      });
    }
  }

  // Approval-gated automation: DB migrations via GitHub Actions.
  // This does NOT execute SQL directly; it triggers a workflow that runs `supabase db push` from the repo.
  if (decision === "approved" && approvalType === "db_migrations_apply") {
    const workflow = env.server.GITHUB_MIGRATIONS_WORKFLOW_FILE ?? "supabase-db-push.yml";
    const ref = env.server.GITHUB_MIGRATIONS_REF ?? "master";
    await dispatchWorkflow({
      workflowFile: workflow,
      ref,
      inputs: {
        organization_id: organizationId,
        approval_id: approvalId,
        requested_by_user_id: String((row as any)?.requested_by_user_id ?? ""),
      },
    });
  }

  const runId = (row as { agent_run_id?: string | null }).agent_run_id;
  if (runId) {
    await db
      .from("agent_runs" as never)
      .update({
        status: decision === "approved" ? "approved" : "rejected",
        finished_at: new Date().toISOString(),
        error_message: decision === "rejected" ? (reason ?? "Rejected") : null,
      } as never)
      .eq("id", runId)
      .eq("organization_id", organizationId);
  }

  await writeAuditLog({
    organizationId,
    actorUserId: userId,
    action: "approval.decision",
    entityType: "approval",
    entityId: approvalId,
    metadata: {
      decision,
      approval_type: approvalType,
      target_entity_type: targetEntityType,
      target_entity_id: targetEntityId,
      next_review_status: targetEntityType && targetEntityId ? nextReviewStatus : null,
    },
  });

  await db.from("analytics_events" as never).insert({
    organization_id: organizationId,
    event_name: "approval_decision",
    source: "admin.approvals.decide",
    campaign_id: (row as any)?.campaign_id ?? null,
    metadata: {
      approval_id: approvalId,
      decision,
      approval_type: approvalType,
      target_entity_type: targetEntityType,
      target_entity_id: targetEntityId,
    },
  } as never);

  let deferredResult: Record<string, unknown> | null = null;
  if (decision === "approved") {
    deferredResult = await applyDeferredToolAfterApproval(db, organizationId, payload);
  }

  return { deferred_result: deferredResult };
}

export async function listCampaignAgents(db: Db, organizationId: string, campaignId: string) {
  const { data, error } = await db
    .from("campaign_agents" as never)
    .select("*, agents(id,key,name)")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function assignCampaignAgent(
  db: Db,
  row: {
    organization_id: string;
    campaign_id: string;
    agent_id: string;
    priority?: number;
    config?: Record<string, unknown>;
  },
) {
  const { data, error } = await db
    .from("campaign_agents" as never)
    .upsert(
      {
        organization_id: row.organization_id,
        campaign_id: row.campaign_id,
        agent_id: row.agent_id,
        priority: row.priority ?? 0,
        config: row.config ?? {},
      } as never,
      { onConflict: "campaign_id,agent_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function removeCampaignAgent(
  db: Db,
  organizationId: string,
  campaignAgentId: string,
) {
  const { error } = await db
    .from("campaign_agents" as never)
    .delete()
    .eq("id", campaignAgentId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}

export async function listSchedules(
  db: Db,
  organizationId: string,
  campaignId?: string,
) {
  const { data, error } = await db
    .from("agent_scheduled_tasks" as never)
    .select("*, agents(key,name)")
    .eq("organization_id", organizationId)
    .match(campaignId ? ({ campaign_id: campaignId } as any) : {})
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteSchedule(db: Db, organizationId: string, scheduleId: string) {
  const { error } = await db
    .from("agent_scheduled_tasks" as never)
    .delete()
    .eq("id", scheduleId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}

export async function upsertSchedule(
  db: Db,
  row: {
    id?: string;
    organization_id: string;
    agent_id: string;
    campaign_id?: string | null;
    name: string;
    cron_expression: string;
    timezone?: string;
    payload?: Record<string, unknown>;
    enabled?: boolean;
    next_run_at?: string | null;
  },
) {
  const tz = row.timezone ?? "UTC";
  const resolvedNext =
    row.next_run_at !== undefined
      ? row.next_run_at
      : computeNextRunIso(row.cron_expression, tz, new Date()) ?? new Date().toISOString();

  if (row.id) {
    const { data, error } = await db
      .from("agent_scheduled_tasks" as never)
      .update({
        name: row.name,
        cron_expression: row.cron_expression,
        timezone: row.timezone ?? "UTC",
        payload: row.payload ?? {},
        enabled: row.enabled ?? true,
        campaign_id: row.campaign_id ?? null,
        next_run_at: resolvedNext,
      } as never)
      .eq("id", row.id)
      .eq("organization_id", row.organization_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await db
    .from("agent_scheduled_tasks" as never)
    .insert({
      organization_id: row.organization_id,
      agent_id: row.agent_id,
      campaign_id: row.campaign_id ?? null,
      name: row.name,
      cron_expression: row.cron_expression,
      timezone: row.timezone ?? "UTC",
      payload: row.payload ?? {},
      enabled: row.enabled ?? true,
      next_run_at: resolvedNext,
    } as never)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
