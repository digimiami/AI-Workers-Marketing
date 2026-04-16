import type { IntegrationCapability } from "@/lib/openclaw/integrations";

export type AgentRegistryEntry = {
  key: string;
  name: string;
  description: string;
  category: "research" | "funnel" | "content" | "distribution" | "nurture" | "conversion" | "analytics";
  defaultApprovalRequired: boolean;
  /** Declared capabilities for future tool routing */
  capabilities: IntegrationCapability[];
  allowedTools: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  defaultSystemPrompt: string;
  defaultStyleRules: string;
  defaultForbiddenClaims: string;
  defaultOutputFormat: string;
};

export const OPENCLAW_AGENT_REGISTRY: AgentRegistryEntry[] = [
  {
    key: "opportunity_scout",
    name: "Opportunity Scout",
    description: "Researches niches, offers, and positioning angles.",
    category: "research",
    defaultApprovalRequired: false,
    capabilities: ["web_research"],
    allowedTools: ["web_research", "internal_analytics"],
    inputSchema: { type: "object", properties: { niche: { type: "string" } } },
    outputSchema: { type: "object", properties: { opportunities: { type: "array" } } },
    defaultSystemPrompt:
      "You are Opportunity Scout. Produce structured opportunities with evidence and risk notes.",
    defaultStyleRules: "Concise, factual, no hype.",
    defaultForbiddenClaims: "No guaranteed income, rankings, or medical/legal claims.",
    defaultOutputFormat: "JSON with keys: opportunities[], summary.",
  },
  {
    key: "funnel_architect",
    name: "Funnel Architect",
    description: "Designs funnel maps, page sections, and CTA tests.",
    category: "funnel",
    defaultApprovalRequired: true,
    capabilities: ["email_draft", "content_publish"],
    allowedTools: ["page_builder", "ab_test", "email_draft"],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    defaultSystemPrompt:
      "You are Funnel Architect. Output funnel steps, copy blocks, and CTA variants as structured JSON.",
    defaultStyleRules: "High-conversion, clear hierarchy, compliance-aware.",
    defaultForbiddenClaims: "No unsubstantiated performance guarantees.",
    defaultOutputFormat: "JSON: steps[], pages[], ctaVariants[].",
  },
  {
    key: "content_strategist",
    name: "Content Strategist",
    description: "Angles, hooks, calendars, and platform-specific plans.",
    category: "content",
    defaultApprovalRequired: false,
    capabilities: ["social_posting", "web_research"],
    allowedTools: ["web_research", "social_posting"],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    defaultSystemPrompt:
      "You are Content Strategist. Produce angles, hooks, and a posting plan with platform tags.",
    defaultStyleRules: "Sharp hooks, varied rhythm, platform-native tone.",
    defaultForbiddenClaims: "Avoid sensitive vertical claims without disclaimers.",
    defaultOutputFormat: "JSON: angles[], plan[], platformTags[].",
  },
  {
    key: "video_worker",
    name: "Video Worker",
    description: "Scripts, overlays, captions, shot suggestions.",
    category: "content",
    defaultApprovalRequired: false,
    capabilities: ["social_posting"],
    allowedTools: ["script", "caption", "storyboard"],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    defaultSystemPrompt:
      "You are Video Worker. Output script beats, on-screen text, captions, and shot list.",
    defaultStyleRules: "Short-form pacing; strong pattern interrupts.",
    defaultForbiddenClaims: "No misleading before/after.",
    defaultOutputFormat: "JSON: script, overlays[], captions[], shots[].",
  },
  {
    key: "publishing_worker",
    name: "Publishing Worker",
    description: "Queues and schedules publishing jobs across platforms.",
    category: "distribution",
    defaultApprovalRequired: true,
    capabilities: ["social_posting", "content_publish"],
    allowedTools: ["content_publish", "social_posting"],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    defaultSystemPrompt:
      "You are Publishing Worker. Produce publish queue items with platform + schedule metadata.",
    defaultStyleRules: "Operational, idempotent, auditable.",
    defaultForbiddenClaims: "N/A",
    defaultOutputFormat: "JSON: queueItems[].",
  },
  {
    key: "lead_nurture_worker",
    name: "Lead Nurture Worker",
    description: "Segments leads, assigns sequences, drafts email steps.",
    category: "nurture",
    defaultApprovalRequired: true,
    capabilities: ["email_draft", "crm_sync"],
    allowedTools: ["email_draft", "crm_sync"],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    defaultSystemPrompt:
      "You are Lead Nurture Worker. Output segment, sequence assignment, and draft emails.",
    defaultStyleRules: "Helpful, specific, consent-aware.",
    defaultForbiddenClaims: "No deceptive urgency.",
    defaultOutputFormat: "JSON: segment, sequenceId, drafts[].",
  },
  {
    key: "conversion_worker",
    name: "Conversion Worker",
    description: "On-site assistant flows and CTA optimization hints.",
    category: "conversion",
    defaultApprovalRequired: true,
    capabilities: ["email_draft"],
    allowedTools: ["chat", "cta_optimizer"],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    defaultSystemPrompt:
      "You are Conversion Worker. Output suggested replies, next actions, and optional email capture prompts.",
    defaultStyleRules: "Respectful, policy-safe, short replies.",
    defaultForbiddenClaims: "No regulated advice without disclaimers.",
    defaultOutputFormat: "JSON: replies[], nextActions[].",
  },
  {
    key: "analyst_worker",
    name: "Analyst Worker",
    description: "Turns metrics into prioritized recommendations.",
    category: "analytics",
    defaultApprovalRequired: false,
    capabilities: ["web_research"],
    allowedTools: ["internal_analytics", "web_research"],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    defaultSystemPrompt:
      "You are Analyst Worker. Output ranked recommendations with rationale and next experiments.",
    defaultStyleRules: "Quant-first, honest about uncertainty.",
    defaultForbiddenClaims: "No fabricated metrics.",
    defaultOutputFormat: "JSON: recommendations[], experiments[].",
  },
];

export function getRegistryEntry(key: string) {
  return OPENCLAW_AGENT_REGISTRY.find((a) => a.key === key);
}
