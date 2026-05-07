import { buildBusinessClassifierUserPrompt, BUSINESS_CLASSIFIER_SYSTEM } from "@/ai/prompts/business_classifier.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Empty sentinel — no fabricated risk notes / recommendations. */
function emptyClassifierFallback(trafficSource: string) {
  return JSON.stringify({
    classification: "",
    confidence: 0,
    bestFunnelType: "direct_response",
    bestTrafficSources: [trafficSource].filter(Boolean),
    recommendedLeadCapture: ["email"],
    riskNotes: [],
  });
}

export async function classifyBusiness(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  urlResearch: Record<string, unknown> | null;
}): Promise<Record<string, unknown>> {
  console.info("[landing] classifier-prompt", {
    url: input.url,
    goal: input.goal,
    audience: input.audience,
    trafficSource: input.trafficSource,
    hasResearch: Boolean(input.urlResearch),
  });
  const out = await runStrictJsonPrompt({
    system: BUSINESS_CLASSIFIER_SYSTEM,
    user: buildBusinessClassifierUserPrompt({
      url: input.url,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      urlResearch: input.urlResearch ?? undefined,
    }),
    fallbackJsonText: emptyClassifierFallback(input.trafficSource),
  });
  const parsed = safeParseRecord(out.jsonText);
  console.info("[landing] classifier-response", {
    used: out.meta.used,
    cacheHit: out.meta.cacheHit,
    classification: String(parsed.classification ?? ""),
    bestFunnelType: String(parsed.bestFunnelType ?? ""),
  });
  return parsed;
}
