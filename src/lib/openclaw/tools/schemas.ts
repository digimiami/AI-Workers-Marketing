import { z } from "zod";

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

