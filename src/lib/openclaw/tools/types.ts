import type { z } from "zod";

export type OpenClawRoleMode =
  | "campaign_launcher"
  | "offer_analyst"
  | "funnel_architect"
  | "content_strategist"
  | "lead_nurture_worker"
  | "analyst"
  | "analyst_worker"
  | "supervisor";

export type OpenClawApprovalMode = "disabled" | "auto" | "enforced";

export type OpenClawActor =
  | { type: "user"; userId: string }
  | { type: "system"; systemActorId: string; userId?: string };

export type OpenClawToolContext = {
  traceId: string;
  organizationId: string;
  actor: OpenClawActor;
  roleMode: OpenClawRoleMode;
  approvalMode: OpenClawApprovalMode;
  campaignId?: string | null;
  agentId?: string | null;
  runId?: string | null;
};

export type OpenClawToolError = {
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "APPROVAL_REQUIRED"
    | "CONFLICT"
    | "NOT_IMPLEMENTED"
    | "INTERNAL_ERROR";
  message: string;
  /** Machine-readable validation or context (e.g. Zod flatten). */
  details?: unknown;
};

export type OpenClawToolResult<T> =
  | { success: true; trace_id: string; data: T }
  | { success: false; trace_id: string; error: OpenClawToolError; data?: never };

export type OpenClawToolDefinition<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
> = {
  name: string;
  description: string;
  input: TInput;
  output: TOutput;
  allowedRoles: OpenClawRoleMode[];
  /** If true, executor may create an approval instead of applying side-effect */
  highRisk?: boolean;
  handler: (ctx: OpenClawToolContext, input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
};

