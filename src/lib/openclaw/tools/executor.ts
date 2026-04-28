import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/services/audit/auditService";
import { assertOrgOperator } from "@/services/org/assertOrgAccess";
import { normalizeToolRunEnvelopeInput, toolRunEnvelopeSchema } from "@/lib/openclaw/tools/schemas";
import { isToolAllowedForRole } from "@/lib/openclaw/tools/roleMatrix";
import type { OpenClawToolContext, OpenClawToolError, OpenClawToolResult } from "@/lib/openclaw/tools/types";
import { getToolByName } from "@/lib/openclaw/tools/tools";

function err(
  traceId: string,
  code: OpenClawToolError["code"],
  message: string,
  details?: unknown,
): OpenClawToolResult<never> {
  const error: OpenClawToolError = { code, message };
  if (details !== undefined) error.details = details;
  return { success: false, trace_id: traceId, error };
}

function ok<T>(traceId: string, data: T): OpenClawToolResult<T> {
  return { success: true, trace_id: traceId, data };
}

function summarizeJson(v: unknown, max = 1800) {
  try {
    const s = JSON.stringify(v ?? {});
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return "[unserializable]";
  }
}

async function insertToolCallLog(row: {
  organization_id: string;
  trace_id: string;
  actor_type: "user" | "system";
  actor_user_id?: string | null;
  system_actor_id?: string | null;
  agent_id?: string | null;
  run_id?: string | null;
  campaign_id?: string | null;
  tool_name: string;
  role_mode?: string | null;
  approval_mode?: string | null;
  approval_required?: boolean;
  approval_id?: string | null;
  ok: boolean;
  error_code?: string | null;
  error_message?: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  await admin.from("openclaw_tool_calls" as never).insert({
    organization_id: row.organization_id,
    trace_id: row.trace_id,
    actor_type: row.actor_type,
    actor_user_id: row.actor_user_id ?? null,
    system_actor_id: row.system_actor_id ?? null,
    agent_id: row.agent_id ?? null,
    run_id: row.run_id ?? null,
    campaign_id: row.campaign_id ?? null,
    tool_name: row.tool_name,
    role_mode: row.role_mode ?? null,
    approval_mode: row.approval_mode ?? null,
    approval_required: row.approval_required ?? false,
    approval_id: row.approval_id ?? null,
    ok: row.ok,
    error_code: row.error_code ?? null,
    error_message: row.error_message ?? null,
    input: row.input ?? {},
    output: row.output ?? {},
  } as never);
}

async function maybeGateWithApproval(params: {
  ctx: OpenClawToolContext;
  toolName: string;
  approvalType: string;
  payload: Record<string, unknown>;
}) {
  if (params.ctx.approvalMode === "disabled") return { gated: false as const };

  // "auto": gate only high-risk tools (handled by tool def) – executor passes approvalType when needed.
  // "enforced": gate whenever tool requested it.
  const admin = createSupabaseAdminClient();
  const requestedBy =
    params.ctx.actor.type === "user" ? params.ctx.actor.userId : params.ctx.actor.userId ?? null;
  const payload = {
    tool: params.toolName,
    trace_id: params.ctx.traceId,
    ...params.payload,
  };

  const tryInsert = async (row: Record<string, unknown>) =>
    admin.from("approvals" as never).insert(row as never).select("id,status").single();

  // Newer DB schemas include agent_run_id / target_entity_*; older schemas may not.
  // Try full insert first, then retry minimal insert if a column is missing.
  let { data, error } = await tryInsert({
    organization_id: params.ctx.organizationId,
    campaign_id: params.ctx.campaignId ?? null,
    status: "pending",
    approval_type: params.approvalType,
    reason_required: true,
    requested_by_user_id: requestedBy,
    agent_run_id: params.ctx.runId ?? null,
    target_entity_type:
      typeof (params.payload as any)?.target_entity_type === "string"
        ? ((params.payload as any).target_entity_type as string)
        : null,
    target_entity_id:
      typeof (params.payload as any)?.target_entity_id === "string"
        ? ((params.payload as any).target_entity_id as string)
        : null,
    payload,
  });

  const msg = String((error as any)?.message ?? "");
  const missingColumn =
    /column .* does not exist/i.test(msg) ||
    /Could not find the '.*' column of '.*' in the schema cache/i.test(msg) ||
    /schema cache/i.test(msg);
  if (error && missingColumn) {
    ({ data, error } = await tryInsert({
      organization_id: params.ctx.organizationId,
      campaign_id: params.ctx.campaignId ?? null,
      status: "pending",
      approval_type: params.approvalType,
      reason_required: true,
      requested_by_user_id: requestedBy,
      payload,
    }));
  }

  if (error || !data) throw new Error((error as any)?.message ?? "Failed to create approval");

  return { gated: true as const, approvalId: (data as { id: string }).id };
}

export async function executeOpenClawTool(rawBody: unknown): Promise<OpenClawToolResult<unknown>> {
  const parsed = toolRunEnvelopeSchema.safeParse(normalizeToolRunEnvelopeInput(rawBody));
  if (!parsed.success) {
    const traceId = "trace_invalid";
    return err(traceId, "VALIDATION_ERROR", "Invalid tool run envelope", {
      zod: parsed.error.flatten(),
      hint: "Required: organization_id (UUID), trace_id (8–120 chars), role_mode, tool_name, actor { type, user_id } for legacy key auth. DB tokens override actor. CamelCase aliases accepted (organizationId, traceId, …).",
    });
  }

  const env = parsed.data;
  const traceId = env.trace_id;

  // Never throw out of this function; Cloud API should return structured JSON errors.
  try {

  // Load tool definition
  const tool = getToolByName(env.tool_name);
  if (!tool) {
    return err(traceId, "NOT_IMPLEMENTED", `Unknown tool: ${env.tool_name}`);
  }

  // Role-based allowlist
  if (!isToolAllowedForRole(env.role_mode, env.tool_name)) {
    return err(traceId, "FORBIDDEN", "Tool not allowed for role mode");
  }

  // Permission check (operator-only for mutations; we enforce operator globally for now)
  // Future: per-tool required minimum role.
  const admin = createSupabaseAdminClient();
  const actorUserId = env.actor.type === "user" ? env.actor.user_id : env.actor.user_id;
  if (!actorUserId) {
    return err(traceId, "UNAUTHORIZED", "Missing actor user context");
  }
  try {
    await assertOrgOperator(admin, actorUserId, env.organization_id);
  } catch {
    return err(traceId, "FORBIDDEN", "Actor is not an org operator");
  }

  const ctx: OpenClawToolContext = {
    traceId,
    organizationId: env.organization_id,
    actor:
      env.actor.type === "user"
        ? { type: "user", userId: env.actor.user_id }
        : { type: "system", systemActorId: env.actor.system_actor_id, userId: env.actor.user_id },
    roleMode: env.role_mode,
    approvalMode: env.approval_mode,
    campaignId: env.campaign_id ?? null,
    agentId: env.agent_id ?? null,
    runId: env.run_id ?? null,
  };

  // Tool input validation (tool.input is zod)
  const inputParsed = (tool.input as z.ZodTypeAny).safeParse(env.input ?? {});
  if (!inputParsed.success) {
    try {
      await insertToolCallLog({
        organization_id: ctx.organizationId,
        trace_id: traceId,
        actor_type: ctx.actor.type,
        actor_user_id: actorUserId,
        system_actor_id: ctx.actor.type === "system" ? ctx.actor.systemActorId : null,
        agent_id: ctx.agentId ?? null,
        run_id: ctx.runId ?? null,
        campaign_id: ctx.campaignId ?? null,
        tool_name: env.tool_name,
        role_mode: env.role_mode,
        approval_mode: env.approval_mode,
        ok: false,
        error_code: "VALIDATION_ERROR",
        error_message: inputParsed.error.message,
        input: env.input,
        output: {},
      });
    } catch {
      // best-effort logging only
    }
    return err(traceId, "VALIDATION_ERROR", "Invalid tool input", {
      zod: inputParsed.error.flatten(),
      tool_name: env.tool_name,
    });
  }

  // Approval gating for high-risk tools
  let approvalId: string | null = null;
  if (tool.highRisk && env.approval_mode !== "disabled") {
    const approvalType =
      env.tool_name === "change_content_status"
        ? "content_publishing"
        : env.tool_name === "queue_test_email"
          ? "email_sending"
          : env.tool_name === "create_tracking_link"
            ? "affiliate_cta_activation"
            : env.tool_name === "apply_supabase_migrations"
              ? "db_migrations_apply"
            : "high_risk_copy";

    const gated = await maybeGateWithApproval({
      ctx,
      toolName: env.tool_name,
      approvalType,
      payload: {
        input: env.input,
        ...(env.tool_name === "change_content_status"
          ? {
              target_entity_type: "content_asset",
              target_entity_id: String((env.input as any)?.content_asset_id ?? ""),
            }
          : {}),
      },
    });
    if (gated.gated) {
      approvalId = gated.approvalId;
      try {
        await insertToolCallLog({
          organization_id: ctx.organizationId,
          trace_id: traceId,
          actor_type: ctx.actor.type,
          actor_user_id: actorUserId,
          system_actor_id: ctx.actor.type === "system" ? ctx.actor.systemActorId : null,
          agent_id: ctx.agentId ?? null,
          run_id: ctx.runId ?? null,
          campaign_id: ctx.campaignId ?? null,
          tool_name: env.tool_name,
          role_mode: env.role_mode,
          approval_mode: env.approval_mode,
          approval_required: true,
          approval_id: approvalId,
          ok: true,
          input: env.input,
          output: { approval_required: true, approval_id: approvalId },
        });
      } catch {
        // best-effort logging only
      }

      return err(traceId, "APPROVAL_REQUIRED", "Approval required before executing this tool");
    }
  }

  try {
    const out = await tool.handler(ctx, inputParsed.data);

    // Audit log (best-effort)
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorUserId,
      action: "agent.run",
      entityType: "openclaw_tool",
      entityId: null,
      metadata: {
        tool: env.tool_name,
        trace_id: traceId,
        role_mode: env.role_mode,
        run_id: ctx.runId ?? null,
        campaign_id: ctx.campaignId ?? null,
        ok: true,
      },
    });

    try {
      await insertToolCallLog({
        organization_id: ctx.organizationId,
        trace_id: traceId,
        actor_type: ctx.actor.type,
        actor_user_id: actorUserId,
        system_actor_id: ctx.actor.type === "system" ? ctx.actor.systemActorId : null,
        agent_id: ctx.agentId ?? null,
        run_id: ctx.runId ?? null,
        campaign_id: ctx.campaignId ?? null,
        tool_name: env.tool_name,
        role_mode: env.role_mode,
        approval_mode: env.approval_mode,
        approval_required: false,
        approval_id: approvalId,
        ok: true,
        input: env.input,
        output: { summary: summarizeJson(out) },
      });
    } catch {
      // best-effort logging only
    }

    return ok(traceId, out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tool execution failed";

    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorUserId,
      action: "agent.run",
      entityType: "openclaw_tool",
      entityId: null,
      metadata: {
        tool: env.tool_name,
        trace_id: traceId,
        role_mode: env.role_mode,
        run_id: ctx.runId ?? null,
        campaign_id: ctx.campaignId ?? null,
        ok: false,
        error: msg,
      },
    });

    try {
      await insertToolCallLog({
        organization_id: ctx.organizationId,
        trace_id: traceId,
        actor_type: ctx.actor.type,
        actor_user_id: actorUserId,
        system_actor_id: ctx.actor.type === "system" ? ctx.actor.systemActorId : null,
        agent_id: ctx.agentId ?? null,
        run_id: ctx.runId ?? null,
        campaign_id: ctx.campaignId ?? null,
        tool_name: env.tool_name,
        role_mode: env.role_mode,
        approval_mode: env.approval_mode,
        ok: false,
        error_code: "INTERNAL_ERROR",
        error_message: msg,
        input: env.input,
        output: {},
      });
    } catch {
      // best-effort logging only
    }

    return err(traceId, "INTERNAL_ERROR", "Tool failed");
  }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unhandled tool error";
    return err(traceId, "INTERNAL_ERROR", msg);
  }
}

