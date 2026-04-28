import { z } from "zod";

export const aiProviderSchema = z.enum(["openclaw", "internal_llm", "hybrid"]);
export type AiProvider = z.infer<typeof aiProviderSchema>;

export const aiModeSchema = z.enum([
  "create_campaign",
  "improve_campaign",
  "generate_content",
  "build_funnel",
  "build_email_sequence",
  "analyze_performance",
  "create_ads",
  "setup_lead_capture",
]);
export type AiMode = z.infer<typeof aiModeSchema>;

export const approvalModeSchema = z.enum(["required", "auto_draft"]);
export type AiApprovalMode = z.infer<typeof approvalModeSchema>;

export const planSchema = z.object({
  objective: z.string().min(1),
  steps: z.array(
    z.object({
      name: z.string().min(1),
      tools_needed: z.array(z.string()).default([]),
      records_to_create: z.array(z.string()).default([]),
      approval_required: z.boolean(),
      risk_level: z.enum(["low", "medium", "high"]),
    }),
  ),
  expected_outputs: z.array(z.string()).default([]),
});
export type AiPlan = z.infer<typeof planSchema>;

export const runInputSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  provider: aiProviderSchema,
  mode: aiModeSchema,
  url: z.string().url().optional(),
  campaignId: z.string().uuid().optional(),
  goal: z.string().min(1),
  niche: z.string().optional(),
  audience: z.string().optional(),
  trafficSource: z.string().optional(),
  campaignType: z.string().optional(),
  notes: z.string().optional(),
  approvalMode: approvalModeSchema,
});
export type RunAiMarketingAgentInput = z.infer<typeof runInputSchema>;

export type RunAiMarketingAgentOutput = {
  runId: string;
  plan: AiPlan;
  createdRecords: Record<string, unknown>;
  updatedRecords: Record<string, unknown>;
  approvalItems: Array<{ id: string; status: string; approval_type: string }>;
  logs: Array<{ level: string; message: string; data?: Record<string, unknown> }>;
  warnings: string[];
  errors: string[];
};

