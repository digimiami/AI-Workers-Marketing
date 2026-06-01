import type { MissionIntent, MissionWorkerKey, RoutedMissionCommand } from "@/domain/mission-control/types";
import type { AiMode } from "@/services/ai-agent/types";

type IntentRule = {
  intent: MissionIntent;
  worker: MissionWorkerKey;
  supporters?: MissionWorkerKey[];
  aiMode: AiMode;
  patterns: RegExp[];
  weight: number;
};

const RULES: IntentRule[] = [
  {
    intent: "create_ads",
    worker: "marketing_worker",
    supporters: ["content_worker", "analytics_worker"],
    aiMode: "create_ads",
    weight: 10,
    patterns: [
      /\b(facebook|meta|instagram)\s+ads?\b/i,
      /\bgoogle\s+ads?\b/i,
      /\btiktok\s+ads?\b/i,
      /\blinkedin\s+ads?\b/i,
      /\bpaid\s+(media|ads?|campaign)\b/i,
      /\bad\s+copy\b/i,
      /\b\$[\d,]+(\s+budget)?\b/i,
    ],
  },
  {
    intent: "build_landing_page",
    worker: "funnel_worker",
    supporters: ["content_worker"],
    aiMode: "build_funnel",
    weight: 9,
    patterns: [/\blanding\s+page\b/i, /\bbuild\s+a\s+page\b/i, /\bhomepage\b/i],
  },
  {
    intent: "build_funnel",
    worker: "funnel_worker",
    supporters: ["email_worker", "crm_worker"],
    aiMode: "build_funnel",
    weight: 9,
    patterns: [/\bsales\s+funnel\b/i, /\bfunnel\b/i, /\blead\s+magnet\b/i, /\bthank\s*you\s+page\b/i],
  },
  {
    intent: "create_email_sequence",
    worker: "email_worker",
    supporters: ["content_worker"],
    aiMode: "build_email_sequence",
    weight: 8,
    patterns: [/\bemail\s+sequence\b/i, /\bwelcome\s+email\b/i, /\bnurture\b/i, /\bbroadcast\b/i],
  },
  {
    intent: "generate_content",
    worker: "content_worker",
    supporters: ["marketing_worker"],
    aiMode: "generate_content",
    weight: 8,
    patterns: [
      /\bblog\b/i,
      /\bseo\b/i,
      /\byoutube\s+script\b/i,
      /\bsocial\s+media\b/i,
      /\bshort[\s-]?form\b/i,
    ],
  },
  {
    intent: "connect_integration",
    worker: "crm_worker",
    aiMode: "setup_lead_capture",
    weight: 7,
    patterns: [
      /\bconnect\s+(my\s+)?(crm|hubspot|gohighlevel|pipedrive|website|ga4|analytics)\b/i,
      /\bintegrat(e|ion)\b/i,
    ],
  },
  {
    intent: "analyze_performance",
    worker: "analytics_worker",
    supporters: ["marketing_worker"],
    aiMode: "analyze_performance",
    weight: 8,
    patterns: [
      /\banalyz(e|ing)\b/i,
      /\bperformance\b/i,
      /\broas\b/i,
      /\bcac\b/i,
      /\breport\b/i,
      /\bmetrics\b/i,
    ],
  },
  {
    intent: "optimize_campaign",
    worker: "analytics_worker",
    supporters: ["marketing_worker", "funnel_worker"],
    aiMode: "improve_campaign",
    weight: 8,
    patterns: [/\boptimi[sz]e\b/i, /\bimprove\s+campaign\b/i, /\bscale\b/i],
  },
  {
    intent: "launch_campaign",
    worker: "marketing_worker",
    supporters: ["funnel_worker", "email_worker", "analytics_worker"],
    aiMode: "create_campaign",
    weight: 9,
    patterns: [/\blaunch\b/i, /\bgo\s+live\b/i, /\bactivate\b/i],
  },
  {
    intent: "lead_generation_playbook",
    worker: "marketing_worker",
    supporters: ["funnel_worker", "content_worker", "email_worker", "analytics_worker", "crm_worker"],
    aiMode: "create_campaign",
    weight: 10,
    patterns: [/\bgenerate\s+\d+\s+leads\b/i, /\blead\s+gen\b/i, /\b100\s+leads\b/i],
  },
  {
    intent: "create_campaign",
    worker: "marketing_worker",
    supporters: ["funnel_worker", "content_worker"],
    aiMode: "create_campaign",
    weight: 6,
    patterns: [/\bmarketing\s+campaign\b/i, /\bcreate\s+campaign\b/i, /\bcampaign\s+for\b/i],
  },
  {
    intent: "build_landing_page",
    worker: "website_worker",
    supporters: ["funnel_worker"],
    aiMode: "build_funnel",
    weight: 7,
    patterns: [/\bwebsite\b/i, /\bnext\.?js\b/i, /\bvercel\b/i, /\bdeploy\b/i, /\bdomain\b/i],
  },
];

const PLAYBOOK_STEPS: Partial<Record<MissionIntent, string[]>> = {
  lead_generation_playbook: [
    "Research business niche and offer",
    "Create compelling offer",
    "Generate landing page variants",
    "Generate ad copy and creatives",
    "Create email nurture sequence",
    "Launch paid campaigns",
    "Track leads and conversions",
    "Run optimization loop",
    "Report results to operator",
  ],
  create_campaign: [
    "Classify business and audience",
    "Draft campaign strategy",
    "Provision funnel and content",
    "Queue approvals for publish",
  ],
  create_ads: ["Draft ad sets", "Set targeting and budget", "Queue launch approval"],
  build_funnel: ["Blueprint funnel", "Generate landing variants", "Publish funnel"],
  build_landing_page: ["Generate landing copy", "Create variants", "Publish selected variant"],
  create_email_sequence: ["Draft sequence", "Activate with approval gate"],
  analyze_performance: ["Collect metrics", "Score variants", "Recommend actions"],
};

export function routeMissionCommand(message: string): RoutedMissionCommand {
  const text = message.trim();
  let best: { rule: IntentRule; score: number } | null = null;

  for (const rule of RULES) {
    let score = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) score += rule.weight;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { rule, score };
    }
  }

  if (!best) {
    return {
      intent: "unknown",
      confidence: 0.2,
      primaryWorker: "marketing_worker",
      supportingWorkers: ["funnel_worker"],
      aiMode: "create_campaign",
      summary: "General business request — routing to Marketing Worker for planning.",
      suggestedPlaybookSteps: ["Clarify goal", "Select campaign", "Assign specialized workers"],
    };
  }

  const confidence = Math.min(0.98, 0.45 + best.score / 30);
  const supporters = best.rule.supporters ?? [];

  return {
    intent: best.rule.intent,
    confidence,
    primaryWorker: best.rule.worker,
    supportingWorkers: supporters,
    aiMode: best.rule.aiMode,
    summary: `Intent: ${best.rule.intent.replace(/_/g, " ")} → ${best.rule.worker.replace(/_/g, " ")}`,
    suggestedPlaybookSteps: PLAYBOOK_STEPS[best.rule.intent] ?? ["Plan", "Execute", "Review"],
  };
}
