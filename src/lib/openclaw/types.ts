/** DB + API aligned run lifecycle */
export type OpenClawRunStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "approved"
  | "rejected";

/** Human gate for agent_output approvals (API + run detail UI). */
export type RunHumanGate =
  | { phase: "not_applicable"; message: string }
  | {
      phase: "awaiting_review";
      approvalId: string;
      reasonRequired: boolean;
      createdAt: string | null;
      payload: Record<string, unknown> | null;
    }
  | {
      phase: "approved";
      approvalId: string | null;
      decidedAt: string | null;
      note: string | null;
    }
  | {
      phase: "rejected";
      approvalId: string | null;
      decidedAt: string | null;
      reason: string | null;
    };

export type OpenClawAgentStatus = "enabled" | "disabled";

export type ExecuteContext = {
  runId: string;
  organizationId: string;
  campaignId: string | null;
  agentKey: string;
  agentName: string;
  systemPrompt: string;
  styleRules: string | null;
  forbiddenClaims: string | null;
  outputFormat: string | null;
  input: Record<string, unknown>;
  /** Recent durable memory for this agent */
  memory: Record<string, unknown>;
  /** Last structured outputs from prior runs (summaries) */
  priorOutputs: Array<{ runId: string; outputType: string; content: Record<string, unknown> }>;
};

export type OpenClawProviderResult = {
  ok: boolean;
  summary?: string;
  errorMessage?: string;
  /** Normalized structured payload (stored in agent_outputs) */
  structuredOutputs?: Array<{ outputType: string; content: Record<string, unknown> }>;
  /** Raw provider response for agent_logs / debugging */
  raw?: unknown;
};

export type OpenClawProviderId = "http" | "stub";

export type OpenClawProvider = {
  readonly id: OpenClawProviderId;
  executeRun(ctx: ExecuteContext): Promise<OpenClawProviderResult>;
  healthCheck(): Promise<{ ok: boolean; message?: string }>;
};
