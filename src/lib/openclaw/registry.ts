import type { IntegrationCapability } from "@/lib/openclaw/integrations";

export type AgentRegistryEntry = {
  key: string;
  name: string;
  description: string;
  /** Operator mission statement (what success looks like) */
  mission: string;
  /** Operating rules (short, enforceable) */
  operatingRules: string[];
  /** Expected structured JSON keys/output contracts */
  expectedOutputs: string[];
  /** Default approval behavior for this worker role */
  approvalBehavior: {
    requireHumanGateByDefault: boolean;
    notes: string;
  };
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
    key: "campaign_launcher",
    name: "Campaign Launcher",
    description: "Creates an end-to-end campaign draft via internal tools (no auto-publish).",
    mission:
      "Turn a brief (affiliate link + niche + audience + traffic + goal) into durable draft records: campaign, funnel, content, email sequence, tracking link.",
    operatingRules: [
      "Operate like an internal operator, not a chatbot.",
      "Prefer tool calls over prose; persist records instead of describing them.",
      "Never publish or send emails automatically.",
      "If a requested action is high-risk, request approval instead of executing.",
      "Log assumptions and decisions as structured JSON.",
    ],
    expectedOutputs: [
      "campaign_id",
      "funnel_id",
      "funnel_steps[]",
      "content_assets[]",
      "email_sequence_id",
      "email_template_ids[]",
      "tracking_link_id",
      "notes",
    ],
    approvalBehavior: {
      requireHumanGateByDefault: false,
      notes: "Draft creation is low risk; publishing/sending is gated by tools.",
    },
    category: "conversion",
    defaultApprovalRequired: false,
    capabilities: [],
    allowedTools: [
      "create_campaign",
      "update_campaign",
      "get_campaign",
      "list_campaigns",
      "create_funnel",
      "update_funnel",
      "add_funnel_step",
      "reorder_funnel_steps",
      "get_funnel",
      "create_content_asset",
      "update_content_asset",
      "create_email_template",
      "create_email_sequence",
      "add_email_sequence_step",
      "create_tracking_link",
      "create_agent_run",
      "append_agent_run_log",
      "complete_agent_run",
      "fail_agent_run",
      "get_pending_approvals",
      "create_approval_item",
    ],
    inputSchema: {
      type: "object",
      properties: {
        affiliate_link: { type: "string" },
        niche: { type: "string" },
        target_audience: { type: "string" },
        traffic_source: { type: "string" },
        campaign_goal: { type: "string" },
        notes: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        funnel_id: { type: "string" },
        tracking_link_id: { type: "string" },
      },
    },
    defaultSystemPrompt:
      "You are Campaign Launcher, an internal operator. Create durable draft records via tools. Return structured JSON only.",
    defaultStyleRules: "Concise. Operational. Prefer IDs, counts, and next actions.",
    defaultForbiddenClaims:
      "No guaranteed outcomes. No medical/legal/financial advice. No deceptive urgency. No fabricated metrics.",
    defaultOutputFormat:
      "Return JSON with keys: campaign, funnel, funnel_steps, content_assets, email, tracking, assumptions, next_actions.",
  },
  {
    key: "offer_analyst",
    name: "Offer Analyst",
    description: "Evaluates an offer/affiliate link and produces a compliant positioning brief.",
    mission:
      "Produce an evidence-aware offer brief (angle, objections, compliance risks, messaging constraints) that other workers can execute.",
    operatingRules: [
      "Do not invent offer details; flag unknowns as assumptions.",
      "Separate facts vs hypotheses.",
      "Return structured brief suitable for downstream tools/workers.",
    ],
    expectedOutputs: ["offer_summary", "angles[]", "objections[]", "compliance_risks[]", "recommended_cta"],
    approvalBehavior: {
      requireHumanGateByDefault: false,
      notes: "Analysis outputs are low risk; publishing is separately gated.",
    },
    category: "research",
    defaultApprovalRequired: false,
    capabilities: [],
    allowedTools: ["log_analytics_event", "get_campaign_metrics", "list_campaigns", "get_campaign"],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    defaultSystemPrompt:
      "You are Offer Analyst. Produce a structured offer brief with compliance notes. No hype.",
    defaultStyleRules: "Clear sections, bullet-like JSON arrays, concise.",
    defaultForbiddenClaims: "No fabricated offer claims. No guaranteed income/results.",
    defaultOutputFormat:
      "JSON: offer_summary, positioning, angles[], objections[], compliance_risks[], recommended_cta, assumptions[].",
  },
  {
    key: "opportunity_scout",
    name: "Opportunity Scout",
    description: "Researches niches, offers, and positioning angles.",
    mission: "Generate ranked opportunity hypotheses with risk notes and next research steps.",
    operatingRules: ["Provide structured opportunities. Flag uncertainty."],
    expectedOutputs: ["opportunities[]", "summary"],
    approvalBehavior: { requireHumanGateByDefault: false, notes: "Research only." },
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
    mission: "Produce a funnel blueprint that can be persisted as funnel steps + copy assets.",
    operatingRules: [
      "Think in steps and persisted records, not paragraphs.",
      "No publishing; produce drafts only.",
      "Prefer tool-driven changes where available.",
    ],
    expectedOutputs: ["funnel_steps[]", "page_blocks[]", "cta_variants[]"],
    approvalBehavior: { requireHumanGateByDefault: true, notes: "Funnel changes may trigger approvals downstream." },
    category: "funnel",
    defaultApprovalRequired: true,
    capabilities: ["email_draft", "content_publish"],
    allowedTools: [
      "create_funnel",
      "update_funnel",
      "add_funnel_step",
      "reorder_funnel_steps",
      "get_funnel",
      "create_content_asset",
      "update_content_asset",
    ],
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
    mission: "Create a content plan and draft batch records that can be persisted as content assets.",
    operatingRules: [
      "Return structured batches and draft assets.",
      "No publishing or outbound posting; queue for review only.",
    ],
    expectedOutputs: ["angles[]", "batch_assets[]", "posting_plan[]"],
    approvalBehavior: { requireHumanGateByDefault: false, notes: "Draft content only." },
    category: "content",
    defaultApprovalRequired: false,
    capabilities: ["social_posting", "web_research"],
    allowedTools: ["create_content_asset", "update_content_asset", "list_content_assets"],
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
    mission: "Produce short-form video scripts and production notes as structured JSON drafts.",
    operatingRules: ["No publishing.", "Return actionable structured fields (script, overlays, captions, shots)."],
    expectedOutputs: ["script", "overlays[]", "captions[]", "shots[]"],
    approvalBehavior: { requireHumanGateByDefault: false, notes: "Draft-only content." },
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
    mission: "Prepare publish queue items for review; never auto-publish without approvals.",
    operatingRules: ["No direct publishing in stub mode.", "Request approval for outbound actions."],
    expectedOutputs: ["queueItems[]"],
    approvalBehavior: { requireHumanGateByDefault: true, notes: "Outbound publishing is high-risk." },
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
    mission: "Turn leads into a safe nurture plan: segmentation, sequence drafts, and enrollment recommendations.",
    operatingRules: [
      "No sending emails automatically.",
      "Use enrollment tools only to queue (if enabled) and always respect approvals.",
      "Return structured segments and next actions.",
    ],
    expectedOutputs: ["segments[]", "sequence_plan", "enrollment_actions[]"],
    approvalBehavior: { requireHumanGateByDefault: true, notes: "Email-related actions may be gated." },
    category: "nurture",
    defaultApprovalRequired: true,
    capabilities: ["email_draft", "crm_sync"],
    allowedTools: [
      "list_leads",
      "update_lead_status",
      "update_lead_score",
      "create_email_template",
      "create_email_sequence",
      "add_email_sequence_step",
      "enroll_lead_in_sequence",
      "queue_test_email",
      "get_pending_approvals",
      "request_approval",
    ],
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
    mission: "Generate on-site conversion helpers (replies, next actions) as structured JSON drafts.",
    operatingRules: ["No regulated advice.", "Be concise and policy-safe.", "Prefer next actions to chatter."],
    expectedOutputs: ["replies[]", "nextActions[]"],
    approvalBehavior: { requireHumanGateByDefault: true, notes: "Conversion copy may require review depending on org policy." },
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
    mission: "Convert analytics into prioritized operational recommendations and experiments.",
    operatingRules: ["No fabricated metrics.", "Prefer simple grouped counts and clear next experiments."],
    expectedOutputs: ["recommendations[]", "experiments[]", "metrics_snapshot"],
    approvalBehavior: { requireHumanGateByDefault: false, notes: "Analysis only." },
    category: "analytics",
    defaultApprovalRequired: false,
    capabilities: ["web_research"],
    allowedTools: ["get_campaign_metrics", "list_campaigns", "list_content_assets", "log_analytics_event"],
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
