import { z } from "zod";

export const marketingPipelineProviderSchema = z.enum(["openclaw", "internal_llm", "hybrid"]);
export type MarketingPipelineProvider = z.infer<typeof marketingPipelineProviderSchema>;

export const marketingPipelineApprovalModeSchema = z.enum(["required", "auto_draft"]);
export type MarketingPipelineApprovalMode = z.infer<typeof marketingPipelineApprovalModeSchema>;

export const marketingPipelineOrgModeSchema = z.enum(["existing", "create"]);
export type MarketingPipelineOrgMode = z.infer<typeof marketingPipelineOrgModeSchema>;

export const marketingPipelineStageKeySchema = z.enum(["research", "strategy", "creation", "execution", "optimization"]);
export type MarketingPipelineStageKey = z.infer<typeof marketingPipelineStageKeySchema>;

export const marketingPipelineStageStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "needs_approval",
]);
export type MarketingPipelineStageStatus = z.infer<typeof marketingPipelineStageStatusSchema>;

export const runMarketingPipelineInputSchema = z.object({
  organizationMode: marketingPipelineOrgModeSchema,
  organizationId: z.string().uuid().nullish(),
  organizationName: z.string().min(2).nullish(),
  // Internal/advanced: allow re-running stages for an existing campaign.
  campaignId: z.string().uuid().nullish(),
  url: z.string().url(),
  mode: z.enum(["affiliate", "client"]),
  goal: z.string().min(2),
  audience: z.string().min(2),
  trafficSource: z.string().min(2),
  notes: z.string().nullish(),
  provider: marketingPipelineProviderSchema,
  approvalMode: marketingPipelineApprovalModeSchema,
  // Internal/advanced: allow stage re-run actions.
  startStage: marketingPipelineStageKeySchema.nullish(),
  stopAfterStage: marketingPipelineStageKeySchema.nullish(),
});

export type RunMarketingPipelineInput = z.infer<typeof runMarketingPipelineInputSchema>;

export type MarketingPipelineRecordRef = {
  table: string;
  id: string;
  label?: string;
};

export type RunMarketingPipelineOutput = {
  organizationId: string;
  campaignId: string | null;
  pipelineRunId: string;
  stages: Record<MarketingPipelineStageKey, { stageId: string; status: MarketingPipelineStageStatus }>;
  createdRecords: MarketingPipelineRecordRef[];
  approvalItems: Array<{ id: string; approval_type?: string }>;
  logs: Array<{ id: string; stage_key?: MarketingPipelineStageKey | null; level: string; message: string; at: string }>;
  warnings: string[];
  errors: string[];
  providerMeta?: Record<string, unknown>;
};

