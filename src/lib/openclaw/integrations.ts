/**
 * Integration contracts for future tools (publishing, CRM, email, research).
 * Implementations live outside the OpenClaw HTTP boundary; orchestration passes
 * intents/capsules through the provider or post-run hooks.
 */

export type IntegrationCapability =
  | "web_research"
  | "social_posting"
  | "crm_sync"
  | "email_draft"
  | "content_publish";

export interface WebResearchTool {
  readonly capability: "web_research";
  /** Narrow query; provider enforces rate limits + safe origins */
  search(params: { query: string; maxResults: number }): Promise<{
    results: Array<{ title: string; url: string; snippet: string }>;
  }>;
}

export interface SocialPostingTool {
  readonly capability: "social_posting";
  schedulePost(params: {
    platform: "tiktok" | "instagram" | "youtube_shorts" | "linkedin" | "x";
    payload: Record<string, unknown>;
  }): Promise<{ providerJobId: string }>;
}

export interface CrmUpdateTool {
  readonly capability: "crm_sync";
  upsertLead(params: {
    externalSystem: string;
    record: Record<string, unknown>;
  }): Promise<{ externalId: string }>;
}

export interface EmailDraftTool {
  readonly capability: "email_draft";
  draftSequenceStep(params: {
    templateId: string;
    variables: Record<string, string>;
  }): Promise<{ subject: string; bodyMarkdown: string }>;
}

export interface ContentPublishTool {
  readonly capability: "content_publish";
  enqueuePublish(params: {
    contentAssetId: string;
    platform: string;
    scheduledFor?: string;
  }): Promise<{ queueId: string }>;
}

/** Registry of tool interfaces an agent may advertise; runtime wiring is vendor-specific per deployment. */
export type OpenClawToolContract =
  | WebResearchTool
  | SocialPostingTool
  | CrmUpdateTool
  | EmailDraftTool
  | ContentPublishTool;
