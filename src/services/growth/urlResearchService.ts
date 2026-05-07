import { buildUrlResearchUserPrompt, URL_RESEARCH_SYSTEM } from "@/ai/prompts/url_research.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Empty sentinel — intentionally NO marketing copy. Callers must treat
 * an empty `businessName`/`offerSummary` as `needs_generation_fix` and surface
 * a regenerate action instead of rendering the placeholder downstream.
 */
function emptyResearchFallback(input: {
  goal: string;
  audience: string;
}) {
  return JSON.stringify({
    businessName: "",
    businessType: "other",
    offerSummary: "",
    targetAudience: input.audience,
    primaryPainPoints: [],
    desiredOutcome: input.goal,
    objections: [],
    trustSignals: [],
    tone: "",
    recommendedCTA: "",
    conversionGoal: input.goal,
  });
}

export async function analyzeUrlResearch(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  orgName?: string | null;
}): Promise<Record<string, unknown>> {
  console.info("[landing] url-research-prompt", {
    url: input.url,
    goal: input.goal,
    audience: input.audience,
    trafficSource: input.trafficSource,
    org: input.orgName ?? null,
  });
  const out = await runStrictJsonPrompt({
    system: URL_RESEARCH_SYSTEM,
    user: buildUrlResearchUserPrompt({
      url: input.url,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      orgName: input.orgName ?? undefined,
    }),
    fallbackJsonText: emptyResearchFallback({ goal: input.goal, audience: input.audience }),
  });
  const parsed = safeParseRecord(out.jsonText);
  console.info("[landing] url-research-response", {
    used: out.meta.used,
    cacheHit: out.meta.cacheHit,
    rawChars: out.jsonText.length,
    businessName: String(parsed.businessName ?? ""),
    businessType: String(parsed.businessType ?? ""),
  });
  return parsed;
}
