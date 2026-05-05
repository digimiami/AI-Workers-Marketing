/** Display contract for AI Workspace live UI + SSE `result` payloads. */

export type LiveModuleOrigin = "db" | "live_preview";

export type LiveResearch = {
  offerSummary: string;
  audience?: string;
  painPoints: string[];
  objections: string[];
  hooks: string[];
  positioning?: string;
  origin: LiveModuleOrigin;
};

export type LiveCampaign = {
  id: string | null;
  name: string;
  goal: string;
  audience: string;
  status: string;
  strategy: string;
  origin: LiveModuleOrigin;
};

export type LiveLanding = {
  id: string | null;
  headline: string;
  subheadline: string;
  bullets: string[];
  ctaText: string;
  previewUrl?: string;
  origin: LiveModuleOrigin;
};

export type LiveFunnelStep = { name: string; type: string; status: string };

export type LiveFunnel = {
  id: string | null;
  name: string;
  steps: LiveFunnelStep[];
  flowDiagram: string;
  origin: LiveModuleOrigin;
};

export type LiveContentItem = {
  id: string;
  hook: string;
  script: string;
  caption: string;
  platform: string;
  cta: string;
};

export type LiveAd = {
  id: string;
  platform: string;
  headline: string;
  primaryText: string;
  cta: string;
  angle: string;
};

export type LiveEmailStep = {
  id: string;
  step: number;
  subject: string;
  preview: string;
  delay: string;
};

export type LiveLeadCapture = {
  id: string | null;
  formName: string;
  fields: string[];
  cta: string;
  publicUrl?: string;
  origin: LiveModuleOrigin;
};

export type LiveAnalytics = {
  trackingLink?: string;
  events: string[];
  status: string;
  origin: LiveModuleOrigin;
};

export type LiveApproval = {
  id: string;
  type: string;
  status: string;
  target: string;
  risk: string;
};

export type LiveWorkspaceResults = {
  run: { runId?: string; campaignId?: string | null };
  research: LiveResearch | null;
  campaign: LiveCampaign | null;
  landing: LiveLanding | null;
  funnel: LiveFunnel | null;
  content: LiveContentItem[];
  ads: LiveAd[];
  emails: LiveEmailStep[];
  leadCapture: LiveLeadCapture | null;
  analytics: LiveAnalytics | null;
  approvals: LiveApproval[];
};

export type LiveBuildStepKey =
  | "research"
  | "campaign"
  | "landing"
  | "funnel"
  | "content"
  | "ads"
  | "emails"
  | "lead_capture"
  | "analytics"
  | "approvals";

export type LiveBuildStepStatus = "pending" | "running" | "complete" | "failed";

export type LiveBuildLogLine = { id: string; level: string; message: string; at: string };

export const LIVE_BUILD_STEP_LABELS: Record<LiveBuildStepKey, string> = {
  research: "Research",
  campaign: "Campaign",
  landing: "Landing page",
  funnel: "Funnel",
  content: "Content",
  ads: "Ads",
  emails: "Emails",
  lead_capture: "Lead capture",
  analytics: "Analytics",
  approvals: "Approvals",
};

export const LIVE_WORKSPACE_TIMELINE_KEYS: LiveBuildStepKey[] = [
  "research",
  "campaign",
  "landing",
  "funnel",
  "content",
  "ads",
  "emails",
  "lead_capture",
  "analytics",
  "approvals",
];

export function liveWorkspaceProgress(steps: Array<{ status: LiveBuildStepStatus }>): number {
  const total = LIVE_WORKSPACE_TIMELINE_KEYS.length;
  const done = steps.filter((s) => s.status === "complete").length;
  return Math.min(1, done / total);
}
