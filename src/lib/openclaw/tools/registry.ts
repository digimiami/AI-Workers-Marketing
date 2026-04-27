import { z } from "zod";

import type { OpenClawToolDefinition } from "@/lib/openclaw/tools/types";

// Minimal domain schemas (per-tool schemas live in tool defs).
const id = z.string().uuid();

// Campaigns
const createCampaignIn = z.object({
  organizationId: id,
  name: z.string().min(1),
  type: z.string().optional(),
  status: z.string().optional(),
  target_audience: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const campaignOut = z.object({
  id,
  name: z.string(),
  status: z.string(),
  type: z.string(),
  organization_id: id,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Funnels
const createFunnelIn = z.object({
  organizationId: id,
  name: z.string().min(1),
  campaign_id: id.nullish(),
  status: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const funnelOut = z.object({
  id,
  name: z.string(),
  status: z.string(),
  campaign_id: id.nullable(),
  organization_id: id,
});

// Funnel steps
const addFunnelStepIn = z.object({
  organizationId: id,
  funnel_id: id,
  name: z.string().min(1),
  step_type: z.string().min(1),
  slug: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const funnelStepOut = z.object({
  id,
  funnel_id: id,
  step_index: z.number().int(),
  name: z.string(),
  step_type: z.string(),
  slug: z.string(),
});

// Content assets
const createContentIn = z.object({
  organizationId: id,
  title: z.string().min(1),
  platform: z.string().optional().nullable(),
  status: z.string().optional(),
  campaign_id: id.nullish(),
  funnel_id: id.nullish(),
  hook: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const contentOut = z.object({
  id,
  title: z.string(),
  status: z.string(),
  campaign_id: id.nullable().optional(),
  funnel_id: id.nullable().optional(),
  organization_id: id,
});

// Email sequences / templates
const createEmailTemplateIn = z.object({
  organizationId: id,
  name: z.string().min(1),
  subject: z.string().min(1),
  body_markdown: z.string().min(1),
  status: z.string().optional(),
});
const emailTemplateOut = z.object({ id, name: z.string(), subject: z.string(), status: z.string() });

const createEmailSequenceIn = z.object({
  organizationId: id,
  campaign_id: id.nullish(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});
const emailSequenceOut = z.object({ id, name: z.string(), is_active: z.boolean(), campaign_id: id.nullable().optional() });

const addEmailStepIn = z.object({
  organizationId: id,
  sequence_id: id,
  template_id: id,
  delay_minutes: z.number().int().min(0),
});
const emailStepOut = z.object({
  id,
  sequence_id: id,
  template_id: id,
  step_index: z.number().int(),
  delay_minutes: z.number().int(),
});

// Leads
const createLeadIn = z.object({
  organizationId: id,
  email: z.string().email().optional().nullable(),
  name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  status: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
  campaign_id: id.nullish(),
  funnel_id: id.nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const leadOut = z.object({ id, email: z.string().nullable(), status: z.string().nullable().optional() });

// Runs
const createRunIn = z.object({
  organizationId: id,
  agent_id: id,
  campaign_id: id.nullish(),
  input: z.record(z.string(), z.unknown()).default({}),
  actor_user_id: id,
});
const createRunOut = z.object({ id, status: z.string(), agent_id: id, campaign_id: id.nullable() });

// Approvals
const createApprovalIn = z.object({
  organizationId: id,
  approval_type: z.string().min(1),
  campaign_id: id.nullish(),
  requested_by_user_id: id.nullish(),
  payload: z.record(z.string(), z.unknown()).default({}),
  reason_required: z.boolean().optional(),
});
const approvalOut = z.object({ id, status: z.string(), approval_type: z.string() });

// Stored tool definitions lose per-tool generic types; keep handler input/output flexible at runtime.
export type AnyToolDef = OpenClawToolDefinition<any, any>;

/**
 * Registry is defined separately from handlers to keep the executor stable.
 * Handlers are attached in `tools.ts`.
 */
export const TOOL_SCHEMAS = {
  createCampaignIn,
  campaignOut,
  createFunnelIn,
  funnelOut,
  addFunnelStepIn,
  funnelStepOut,
  createContentIn,
  contentOut,
  createEmailTemplateIn,
  emailTemplateOut,
  createEmailSequenceIn,
  emailSequenceOut,
  addEmailStepIn,
  emailStepOut,
  createLeadIn,
  leadOut,
  createRunIn,
  createRunOut,
  createApprovalIn,
  approvalOut,
};

