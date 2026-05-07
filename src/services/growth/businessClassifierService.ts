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

export async function classifyBusiness(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  urlResearch: Record<string, unknown> | null;
}): Promise<Record<string, unknown>> {
  const fallbackJsonText = JSON.stringify({
    classification: "general_market",
    confidence: 0.35,
    bestFunnelType: "direct_response",
    bestTrafficSources: [input.trafficSource, "google_search", "meta_feed"],
    recommendedLeadCapture: ["email", "name"],
    riskNotes: [
      "Limited URL evidence — validate claims on the live site before scaling spend.",
      "Ensure compliance with platform policies for the stated vertical.",
    ],
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
    fallbackJsonText,
  });
  return safeParseRecord(out.jsonText);
}
