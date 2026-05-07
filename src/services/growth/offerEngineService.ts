import { buildOfferEngineUserPrompt, OFFER_ENGINE_SYSTEM } from "@/ai/prompts/offer_engine.prompt";
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
 * Empty sentinel — intentionally NO marketing copy in the fallback.
 * If the AI provider is unavailable the caller must surface a regenerate action
 * rather than serving template language to end users.
 */
function emptyOfferFallback() {
  return JSON.stringify({
    step1: { dreamOutcome: "", biggestPain: "", fastestPath: "", whyCurrentSolutionsFail: "" },
    step2: { offerName: "", mechanism: "", timeToResult: "", riskReversal: "", whyDifferent: "" },
    step3: {
      headline: "",
      subheadline: "",
      ctaText: "",
      benefits: [],
      steps: [],
      trustSection: "",
      ctaSection: { headline: "", subheadline: "", ctaText: "" },
    },
  });
}

export async function generateOfferBundle(input: {
  businessAnalysis: Record<string, unknown> | null;
  targetAudience: string;
  goal: string;
  trafficSource: string;
}) {
  console.info("[landing] offer-prompt", {
    hasAnalysis: Boolean(input.businessAnalysis),
    targetAudience: input.targetAudience,
    goal: input.goal,
    trafficSource: input.trafficSource,
  });
  const out = await runStrictJsonPrompt({
    system: OFFER_ENGINE_SYSTEM,
    user: buildOfferEngineUserPrompt({
      businessAnalysis: input.businessAnalysis,
      targetAudience: input.targetAudience,
      goal: input.goal,
      trafficSource: input.trafficSource,
    }),
    fallbackJsonText: emptyOfferFallback(),
  });

  const parsed = safeParseRecord(out.jsonText);
  console.info("[landing] offer-response", {
    used: out.meta.used,
    cacheHit: out.meta.cacheHit,
    offerName: String(((parsed as { step2?: { offerName?: unknown } }).step2 ?? {}).offerName ?? ""),
    headline: String(((parsed as { step3?: { headline?: unknown } }).step3 ?? {}).headline ?? "").slice(0, 80),
  });

  return { offer: parsed, meta: out.meta };
}
