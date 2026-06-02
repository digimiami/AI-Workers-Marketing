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
};

function uniqStrings(v: string[]) {
  return Array.from(new Set(v.map((s) => s.trim()).filter(Boolean)));
}

export function extractIntakePatchFromMessage(message: string): Partial<MissionControlIntake> {
  const text = message.trim();
  const patch: Partial<MissionControlIntake> = {};

  const goalLine = text.match(/\b(goal|objective)\s*:\s*([^\n]+)/i);
  if (goalLine?.[2]) patch.goal = goalLine[2].trim().slice(0, 300);

  const audienceLine = text.match(/\b(audience|target)\s*:\s*([^\n]+)/i);
  if (audienceLine?.[2]) patch.audience = audienceLine[2].trim().slice(0, 300);

  const urlMatch = text.match(/\bhttps?:\/\/[^\s)]+/i);
  if (urlMatch?.[0]) patch.websiteUrl = urlMatch[0].replace(/[),.]+$/, "");

  const budgetMatch = text.match(/\$?\s?(\d{2,6})(?:\s*(?:\/\s*(day|mo|month))|\s*(daily|monthly))?/i);
  if (budgetMatch?.[0] && /\b(budget|spend|day|daily|month|monthly)\b/i.test(text)) {
    patch.budgetText = budgetMatch[0].trim();
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
  else if (/\bgoogle\b/i.test(text)) patch.trafficSource = "google";
  else if (/\btiktok\b/i.test(text)) patch.trafficSource = "tiktok";
  else if (/\blinkedin\b/i.test(text)) patch.trafficSource = "linkedin";

  return patch;
}

export function mergeIntake(base: MissionControlIntake, patch: Partial<MissionControlIntake>): MissionControlIntake {
  return {
    ...base,
    ...patch,
    keywords: patch.keywords ? uniqStrings([...(base.keywords ?? []), ...patch.keywords]) : base.keywords,
  };
}

export function computeMissingForFastLaunch(intake: MissionControlIntake): Array<keyof MissionControlIntake> {
  const missing: Array<keyof MissionControlIntake> = [];
  if (!intake.websiteUrl) missing.push("websiteUrl");
  if (!intake.keywords || intake.keywords.length === 0) missing.push("keywords");
  if (!intake.goal) missing.push("goal");
  if (!intake.audience) missing.push("audience");
  if (!intake.trafficSource || intake.trafficSource === "unknown") missing.push("trafficSource");
  if (!intake.budgetText) missing.push("budgetText");
  return missing;
}

export function buildIntakeQuestionReply(input: {
  missing: Array<keyof MissionControlIntake>;
  intake: MissionControlIntake;
}) {
  const { missing, intake } = input;
  const lines: string[] = [];
  const suggestions: string[] = [];

  lines.push("Perfect — I can do this fast. I just need a couple details first.");
  lines.push("");

  if (missing.includes("websiteUrl")) {
    lines.push("1) What’s your website URL? (paste it here — I’ll do a quick research scan)");
    suggestions.push("My website is https://");
    suggestions.push("No website yet");
  }
  if (missing.includes("keywords")) {
    lines.push("2) Give me 3–8 keywords you want leads for (or say “use my website copy”).");
    suggestions.push("Keywords: roofing, roof repair, roof replacement, emergency roofer");
    if (intake.websiteUrl) suggestions.push("Use my website copy for keywords");
  }
  if (missing.includes("goal")) {
    lines.push("3) What’s the goal? (leads, booked calls, quote requests, sales, etc.)");
    suggestions.push("Goal: generate leads");
    suggestions.push("Goal: booked calls");
  }
  if (missing.includes("audience")) {
    lines.push("4) Who’s the audience? (location + customer type)");
    suggestions.push("Audience: homeowners in Miami");
    suggestions.push("Audience: commercial property managers");
  }
  if (missing.includes("trafficSource")) {
    lines.push("5) Which traffic source should we start with?");
    suggestions.push("Meta Ads");
    suggestions.push("Google Ads");
  }
  if (missing.includes("budgetText")) {
    lines.push("6) What budget should I plan for?");
    suggestions.push("$500 budget");
    suggestions.push("$50/day");
  }

  // Always offer Zernio connect as a quick next step when relevant.
  if (!intake.wantsConnectZernio) {
    suggestions.push("Connect Zernio");
  }

  lines.push("");
  lines.push("Once you reply, I’ll: research → generate keywords/angles → generate campaign + funnel + landing → prep ads.");

  return { reply: lines.join("\n"), suggestions: uniqStrings(suggestions).slice(0, 8) };
}

