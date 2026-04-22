import { z } from "zod";

/**
 * Many HTTP agents send camelCase; AiWorkers expects snake_case on the tool envelope.
 * Fills snake keys only when missing so native snake_case bodies stay unchanged.
 */
export function normalizeToolRunEnvelopeInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const body = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...body };
  const alias = (camel: string, snake: string) => {
    if (out[snake] === undefined || out[snake] === null) {
      const v = out[camel];
      if (v !== undefined && v !== null) out[snake] = v;
    }
  };
  alias("organizationId", "organization_id");
  alias("traceId", "trace_id");
  alias("roleMode", "role_mode");
  alias("approvalMode", "approval_mode");
  alias("toolName", "tool_name");
  alias("campaignId", "campaign_id");
  alias("agentId", "agent_id");
  alias("runId", "run_id");

  const actor = out.actor;
  if (actor && typeof actor === "object" && !Array.isArray(actor)) {
    const a: Record<string, unknown> = { ...(actor as Record<string, unknown>) };
    if (a.user_id === undefined || a.user_id === null) {
      const uid = a.userId;
      if (typeof uid === "string") a.user_id = uid;
    }
    if (a.system_actor_id === undefined || a.system_actor_id === null) {
      const sid = a.systemActorId;
      if (typeof sid === "string") a.system_actor_id = sid;
    }
    out.actor = a;
  }
  return out;
}

export const toolRunEnvelopeSchema = z.object({
  organization_id: z.string().uuid(),
  trace_id: z.string().min(8).max(120),
  role_mode: z.enum([
    "campaign_launcher",
    "offer_analyst",
    "funnel_architect",
    "content_strategist",
    "lead_nurture_worker",
    "analyst",
    /** Alias for agent key `analyst_worker` — same tool allowlist as `analyst`. */
    "analyst_worker",
    "supervisor",
  ]),
  approval_mode: z.enum(["disabled", "auto", "enforced"]).default("auto"),
  actor: z.discriminatedUnion("type", [
    z.object({ type: z.literal("user"), user_id: z.string().uuid() }),
    z.object({
      type: z.literal("system"),
      system_actor_id: z.string().min(3).max(120),
      user_id: z.string().uuid().optional(),
    }),
  ]),
  campaign_id: z.string().uuid().nullish(),
  agent_id: z.string().uuid().nullish(),
  run_id: z.string().uuid().nullish(),
  tool_name: z.string().min(1).max(120),
  input: z.record(z.string(), z.unknown()).default({}),
});

export const toolResponseSchema = z.object({
  success: z.boolean(),
  trace_id: z.string(),
  data: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

