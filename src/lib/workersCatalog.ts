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
    tagline: "Find angles, offers, and positioning that convert.",
    inputs: ["Niche", "Target audience", "Business goal", "Constraints"],
    outputs: ["Opportunities", "Angles", "Competitor notes", "Offer shortlist"],
    kpis: ["CTR", "CPL", "ROAS", "Conversion rate"],
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
    tagline: "Generate landing + bridge flows with testing baked in.",
    inputs: ["Selected opportunity", "Brand voice", "Traffic source"],
    outputs: ["Funnel map", "Page sections", "Copy drafts", "CTA variants"],
    kpis: ["Landing CVR", "Lead rate", "Click-to-offer", "EPC"],
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
    tagline: "Turn offers into daily content angles and plans.",
    inputs: ["Offer + funnel", "Audience pains", "Platform mix"],
    outputs: ["Content angles", "Posting plan", "Hooks", "CTAs"],
    kpis: ["Views", "Clicks", "Lead rate", "Follower growth"],
    tools: ["Platform playbooks", "Hook library", "Performance feedback"],
    flow: ["Generate angles", "Batch ideas", "Create platform variants"],
  },
  {
    key: "video-worker",
    name: "Video Worker",
    tagline: "Create short-form scripts and shot lists fast.",
    inputs: ["Angle", "Hook", "Offer constraints", "Length"],
    outputs: ["Script", "Overlays", "Captions", "Shots"],
    kpis: ["Watch time", "CTR", "Saves", "Shares"],
    tools: ["Script templates", "Storyboard patterns"],
    flow: ["Select angle", "Draft scripts", "Save as content assets"],
  },
  {
    key: "publishing-worker",
    name: "Publishing Worker",
    tagline: "Queue and schedule publishing across platforms.",
    inputs: ["Approved content asset", "Platform targets", "Schedule"],
    outputs: ["Publish jobs", "Platform links", "Status updates"],
    kpis: ["Publishing volume", "On-time rate", "Link clicks"],
    tools: ["Queue", "Provider connectors (TODO)"],
    flow: ["Approve content", "Schedule", "Publish + log outcome"],
  },
  {
    key: "lead-nurture-worker",
    name: "Lead Nurture Worker",
    tagline: "Segment leads and draft sequences that close.",
    inputs: ["Lead profile", "Offer", "Objections", "Stage"],
    outputs: ["Segment", "Sequence assignment", "Email drafts"],
    kpis: ["Open rate", "Reply rate", "Booked calls", "Conversion rate"],
    tools: ["Resend (send)", "Approval system", "Templates"],
    flow: ["Lead captured", "Segment + assign", "Draft + (optional) send"],
  },
  {
    key: "conversion-worker",
    name: "Conversion Worker",
    tagline: "On-site assistant + CTA optimization guidance.",
    inputs: ["Visitor intent", "Page context", "Offer", "Policy rules"],
    outputs: ["Suggested next action", "Email capture prompts", "Booking CTA"],
    kpis: ["Chat-to-lead", "Book rate", "Bounce rate"],
    tools: ["Chat widget", "Sensitive copy guardrails"],
    flow: ["Detect intent", "Recommend action", "Log interactions"],
  },
  {
    key: "analyst-worker",
    name: "Analyst Worker",
    tagline: "Turn performance data into clear next actions.",
    inputs: ["Analytics events", "Campaign context", "Targets"],
    outputs: ["Recommendations", "What to scale/pause", "Test ideas"],
    kpis: ["CPA", "ROAS", "Conversion rate", "Velocity"],
    tools: ["Dashboards", "Event queries", "Experiment tracking"],
    flow: ["Review metrics", "Generate recs", "Create tasks/approvals"],
  },
];

export function getWorkerByKey(key: string) {
  return WORKERS.find((w) => w.key === key);
}

