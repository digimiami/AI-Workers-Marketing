export type WorkerKey =
  | "opportunity-scout"
  | "funnel-architect"
  | "content-strategist"
  | "video-worker"
  | "publishing-worker"
  | "lead-nurture-worker"
  | "conversion-worker"
  | "analyst-worker";

export type WorkerCard = {
  key: WorkerKey;
  name: string;
  tagline: string;
  inputs: string[];
  outputs: string[];
  kpis: string[];
  tools: string[];
  flow: string[];
};

export const WORKERS: WorkerCard[] = [
  {
    key: "opportunity-scout",
    name: "Opportunity Scout",
    tagline: "Turn market noise into a ranked opportunity backlog.",
    inputs: ["Niche", "Target audience", "Business goal", "Constraints"],
    outputs: ["Opportunities", "Angles", "Competitor notes", "Offer shortlist"],
    kpis: ["Qualified angles", "Test velocity", "CTR lift", "CPL trend"],
    tools: ["Web research", "Offer scoring rubric", "Internal event data"],
    flow: [
      "Ingest niche + audience + goal",
      "Research offers/angles",
      "Return structured opportunity list",
    ],
  },
  {
    key: "funnel-architect",
    name: "Funnel Architect",
    tagline: "Convert an angle into a testable funnel with guardrails.",
    inputs: ["Selected opportunity", "Brand voice", "Traffic source"],
    outputs: ["Funnel map", "Page sections", "Copy drafts", "CTA variants"],
    kpis: ["Landing CVR", "Lead rate", "Click-to-offer", "Time-to-launch"],
    tools: ["Funnel patterns", "Compliance rules", "A/B testing"],
    flow: [
      "Choose opportunity",
      "Design steps + copy blocks",
      "Save drafts for human editing",
    ],
  },
  {
    key: "content-strategist",
    name: "Content Strategist",
    tagline: "Generate a content engine tied to funnel stages and CTAs.",
    inputs: ["Offer + funnel", "Audience pains", "Platform mix"],
    outputs: ["Content angles", "Posting plan", "Hooks", "CTAs"],
    kpis: ["Publish cadence", "Click share", "Lead rate", "Angle hit-rate"],
    tools: ["Platform playbooks", "Hook library", "Performance feedback"],
    flow: ["Generate angles", "Batch ideas", "Create platform variants"],
  },
  {
    key: "video-worker",
    name: "Video Worker",
    tagline: "Turn winning angles into scripts optimized for retention.",
    inputs: ["Angle", "Hook", "Offer constraints", "Length"],
    outputs: ["Script", "Overlays", "Captions", "Shots"],
    kpis: ["Watch time", "CTR", "Saves", "Shares"],
    tools: ["Script templates", "Storyboard patterns"],
    flow: ["Select angle", "Draft scripts", "Save as content assets"],
  },
  {
    key: "publishing-worker",
    name: "Publishing Worker",
    tagline: "Ship content on schedule and log what happened.",
    inputs: ["Approved content asset", "Platform targets", "Schedule"],
    outputs: ["Publish jobs", "Platform links", "Status updates"],
    kpis: ["On-time rate", "Link clicks", "Content shipped", "Ops overhead"],
    tools: ["Queue", "Platform connectors (per deployment)"],
    flow: ["Approve content", "Schedule", "Publish + log outcome"],
  },
  {
    key: "lead-nurture-worker",
    name: "Lead Nurture Worker",
    tagline: "Turn captured leads into booked calls with approvals.",
    inputs: ["Lead profile", "Offer", "Objections", "Stage"],
    outputs: ["Segment", "Sequence assignment", "Email drafts"],
    kpis: ["Open rate", "Reply rate", "Booked calls", "Conversion rate"],
    tools: ["Resend (send)", "Approval system", "Templates"],
    flow: ["Lead captured", "Segment + assign", "Draft + (optional) send"],
  },
  {
    key: "conversion-worker",
    name: "Conversion Worker",
    tagline: "Increase on-site conversion with guided next actions.",
    inputs: ["Visitor intent", "Page context", "Offer", "Policy rules"],
    outputs: ["Suggested next action", "Email capture prompts", "Booking CTA"],
    kpis: ["Chat-to-lead", "Book rate", "Bounce rate"],
    tools: ["Chat widget", "Sensitive copy guardrails"],
    flow: ["Detect intent", "Recommend action", "Log interactions"],
  },
  {
    key: "analyst-worker",
    name: "Analyst Worker",
    tagline: "Close the loop: turn telemetry into prioritized next tests.",
    inputs: ["Analytics events", "Campaign context", "Targets"],
    outputs: ["Recommendations", "What to scale/pause", "Test ideas"],
    kpis: ["CPA", "ROAS", "Win-rate", "Iteration velocity"],
    tools: ["Dashboards", "Event queries", "Experiment tracking"],
    flow: ["Review metrics", "Generate recs", "Create tasks/approvals"],
  },
];

export function getWorkerByKey(key: string) {
  return WORKERS.find((w) => w.key === key);
}

