export type MissionControlIntake = {
  websiteUrl?: string;
  businessType?: string;
  location?: string;
  goal?: string;
  audience?: string;
  trafficSource?: "meta" | "google" | "tiktok" | "linkedin" | "unknown";
  budgetText?: string;
  keywords?: string[];
  wantsConnectZernio?: boolean;
  approvedToLaunch?: boolean;
  pipelineRunId?: string;
};

const DOMAIN_RE = /\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)\b/gi;
const DOMAIN_BLOCKLIST = new Set([
  "aiworkers.vip",
  "agents.aiworkers.vip",
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
]);

function uniqStrings(v: string[]) {
  return Array.from(new Set(v.map((s) => s.trim()).filter(Boolean)));
}

export function normalizeWebsiteUrl(raw: string): string {
  const t = raw.trim().replace(/[),.]+$/, "");
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/\//, "")}`;
}

function extractDomainFromText(text: string): string | undefined {
  const matches = text.match(DOMAIN_RE) ?? [];
  for (const m of matches) {
    const lower = m.toLowerCase();
    if (DOMAIN_BLOCKLIST.has(lower)) continue;
    if (!lower.includes(".")) continue;
    const tld = lower.split(".").pop() ?? "";
    if (tld.length < 2 || tld.length > 24) continue;
    return lower;
  }
  return undefined;
}

export function isGreetingOnly(message: string): boolean {
  const t = message.trim();
  if (t.length > 40) return false;
  return /^(hi|hello|hey|howdy|yo|good\s+(morning|afternoon|evening)|what'?s\s+up|sup)[!.?\s]*$/i.test(t);
}

export function hasLaunchApproval(message: string): boolean {
  return /\b(go\s+ahead|do\s+(it|your\s+best)|start\s+(now|building|the)|build\s+it|launch\s+it|scan\s+(the\s+)?site|run\s+it|proceed|yes\s+please|make\s+it\s+happen)\b/i.test(
    message.trim(),
  );
}

export function extractIntakePatchFromMessage(message: string): Partial<MissionControlIntake> {
  const text = message.trim();
  const patch: Partial<MissionControlIntake> = {};

  const goalLine = text.match(/\b(goal|objective)\s*:\s*([^\n]+)/i);
  if (goalLine?.[2]) patch.goal = goalLine[2].trim().slice(0, 300);

  const audienceLine = text.match(/\b(audience|target)\s*:\s*([^\n]+)/i);
  if (audienceLine?.[2]) patch.audience = audienceLine[2].trim().slice(0, 300);

  const urlMatch = text.match(/\bhttps?:\/\/[^\s)]+/i);
  if (urlMatch?.[0]) {
    patch.websiteUrl = normalizeWebsiteUrl(urlMatch[0]);
  } else {
    const domain = extractDomainFromText(text);
    if (domain) patch.websiteUrl = normalizeWebsiteUrl(domain);
  }

  const budgetMatch = text.match(/\$?\s?(\d{2,6})(?:\s*(?:\/\s*(day|mo|month))|\s*(daily|monthly))?/i);
  if (budgetMatch?.[0] && /\b(budget|spend|day|daily|month|monthly)\b/i.test(text)) {
    patch.budgetText = budgetMatch[0].trim();
  } else if (/\$\d{2,6}\b/.test(text)) {
    patch.budgetText = text.match(/\$\d{2,6}\b/)?.[0];
  }

  const kwLine = text.match(/\bkeywords?\s*:\s*([^\n]+)/i);
  if (kwLine?.[1]) {
    patch.keywords = uniqStrings(
      kwLine[1]
        .split(/[,|]/g)
        .map((s) => s.trim())
        .filter(Boolean),
    ).slice(0, 15);
  }

  if (/\bzernio\b/i.test(text) && /\b(connect|setup|set up|integrat|api key)\b/i.test(text)) {
    patch.wantsConnectZernio = true;
  }

  if (/\bfacebook\b|\bmeta\b|\binstagram\b/i.test(text)) patch.trafficSource = "meta";
  else if (/\bgoogle\b|\badwords?\b/i.test(text)) patch.trafficSource = "google";
  else if (/\btiktok\b/i.test(text)) patch.trafficSource = "tiktok";
  else if (/\blinkedin\b/i.test(text)) patch.trafficSource = "linkedin";

  if (!patch.goal) {
    if (/\b(find|get|generate|new)\s+leads?\b/i.test(text)) patch.goal = "generate leads";
    else if (/\b(schedul(e|ing)|book(ed)?)\s+(a\s+)?(consultation|call|appointment)s?\b/i.test(text)) {
      patch.goal = "schedule consultations";
    } else if (/\bquote\s+requests?\b/i.test(text)) patch.goal = "quote requests";
    else if (/\bsales?\b/i.test(text)) patch.goal = "drive sales";
  }

  const locationMatch = text.match(/\b(?:in|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/);
  if (locationMatch?.[1]) patch.location = locationMatch[1].trim();

  if (hasLaunchApproval(text)) patch.approvedToLaunch = true;

  if (/\bno\s+website\b/i.test(text)) patch.websiteUrl = undefined;

  return patch;
}

export function mergeIntakeFromHistory(
  base: MissionControlIntake,
  history: Array<{ role: string; content: string }>,
  latestMessage: string,
): MissionControlIntake {
  let intake = { ...base };
  for (const turn of history) {
    if (turn.role !== "user") continue;
    intake = mergeIntake(intake, extractIntakePatchFromMessage(turn.content));
  }
  return mergeIntake(intake, extractIntakePatchFromMessage(latestMessage));
}

export function mergeIntake(base: MissionControlIntake, patch: Partial<MissionControlIntake>): MissionControlIntake {
  return {
    ...base,
    ...patch,
    keywords: patch.keywords ? uniqStrings([...(base.keywords ?? []), ...patch.keywords]) : base.keywords,
    approvedToLaunch: patch.approvedToLaunch || base.approvedToLaunch,
  };
}

const ACTION_INTENTS = new Set([
  "create_campaign",
  "build_funnel",
  "create_ads",
  "lead_generation_playbook",
  "build_landing_page",
  "launch_campaign",
]);

export function canAutoLaunch(intake: MissionControlIntake): boolean {
  if (intake.websiteUrl) return true;
  const kw = intake.keywords ?? [];
  if (kw.length >= 2 && (intake.goal || intake.location)) return true;
  return false;
}

export function shouldBlockForIntake(params: {
  intake: MissionControlIntake;
  message: string;
  intent: string;
}): { block: true; mode: "greeting" | "minimal" } | { block: false } {
  const { intake, message, intent } = params;
  if (!ACTION_INTENTS.has(intent)) return { block: false };
  if (canAutoLaunch(intake)) return { block: false };
  if (hasLaunchApproval(message) && intake.websiteUrl) return { block: false };

  if (isGreetingOnly(message)) return { block: true, mode: "greeting" };

  if (!intake.websiteUrl && !(intake.keywords?.length && intake.location)) {
    return { block: true, mode: "minimal" };
  }

  return { block: false };
}

export function buildIntakeQuestionReply(input: {
  mode: "greeting" | "minimal";
  intake: MissionControlIntake;
}) {
  const { mode, intake } = input;
  const suggestions: string[] = [];

  if (mode === "greeting") {
    return {
      reply: [
        "Hey — great to meet you.",
        "",
        "Paste your **website URL** and I’ll scan it, pull your audience + keywords, and start building your funnel, landing page, and ad campaign automatically.",
        "",
        "No website yet? Send **keywords + target city/area + what you want** (e.g. “roof repair leads in Miami”).",
      ].join("\n"),
      suggestions: [
        "My site is https://",
        "Keywords: roofing, roof repair — Miami",
        "Generate leads for my business",
      ],
    };
  }

  const lines: string[] = [
    "I’m ready to build — I just need one of these:",
    "",
    "• **Website URL** — I’ll scan the site and infer audience, keywords, offer, and locations.",
    "• **OR** 3+ keywords + target area + goal (if you don’t have a site yet).",
  ];

  if (!intake.websiteUrl) {
    suggestions.push("My website is https://");
    suggestions.push("Scan dulcediaz.com and build everything");
  }
  if (!intake.keywords?.length) {
    suggestions.push("Keywords: consultation, booking, local service");
  }
  if (!intake.goal) suggestions.push("Goal: schedule consultations");
  suggestions.push("Go ahead — do your best");

  lines.push("");
  lines.push("Once I have that, I’ll **start the build in Workspace** — research → funnel → landing → ads.");

  return { reply: lines.join("\n"), suggestions: uniqStrings(suggestions).slice(0, 6) };
}

export function buildAutonomousLaunchReply(input: {
  intake: MissionControlIntake;
  pipelineRunId: string;
  workspaceUrl: string;
}): { reply: string; suggestions: string[]; workspaceUrl: string } {
  const site = input.intake.websiteUrl ?? "your inputs";
  const goal = input.intake.goal ?? "generate leads";
  const channel =
    input.intake.trafficSource === "google"
      ? "Google Ads"
      : input.intake.trafficSource === "meta"
        ? "Meta Ads"
        : "paid search + social";

  return {
    reply: [
      `On it — I’m building your campaign now.`,
      ``,
      `**Site:** ${site}`,
      `**Goal:** ${goal}`,
      `**Channel:** ${channel}`,
      ``,
      `Right now I’m:`,
      `1. Scanning the website and extracting audience, locations, and keywords`,
      `2. Generating funnel + landing page variants`,
      `3. Drafting ${channel} ads and lead capture`,
      ``,
      `Open **Workspace** to watch progress live. I’ll pause for your approval before anything goes live.`,
    ].join("\n"),
    suggestions: ["Open Workspace", "Show me audiences", "Change budget to $500"],
    workspaceUrl: input.workspaceUrl,
  };
}

// Legacy export kept for callers that still reference computeMissingForFastLaunch
export function computeMissingForFastLaunch(intake: MissionControlIntake): Array<keyof MissionControlIntake> {
  if (canAutoLaunch(intake)) return [];
  const missing: Array<keyof MissionControlIntake> = [];
  if (!intake.websiteUrl) missing.push("websiteUrl");
  if (!intake.keywords?.length) missing.push("keywords");
  return missing;
}
