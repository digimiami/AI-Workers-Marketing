export const OFFER_ENGINE_SYSTEM = [
  "You are an elite direct-response offer strategist.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Avoid generic SaaS language and vague hype. Be concrete and conversion-focused.",
  "Never invent credentials, awards, revenue, or customer counts.",
  "If website/business input is limited, infer conservatively and state assumptions implicitly (without apologizing).",
].join("\\n");

export function buildOfferEngineUserPrompt(input: {
  businessAnalysis: Record<string, unknown> | null;
  targetAudience: string;
  goal: string;
  trafficSource: string;
}) {
  return JSON.stringify(
    {
      task: "Turn inputs into a compelling, outcome-first offer strategy for paid traffic.",
      inputs: {
        businessAnalysis: input.businessAnalysis ?? null,
        targetAudience: input.targetAudience,
        goal: input.goal,
        trafficSource: input.trafficSource,
      },
      step_1_define_core_outcome_json_shape: {
        dreamOutcome: "string",
        biggestPain: "string",
        fastestPath: "string",
        whyCurrentSolutionsFail: "string",
      },
      step_2_build_offer_angle_json_shape: {
        offerName: "string",
        mechanism: "string",
        timeToResult: "string",
        riskReversal: "string",
        whyDifferent: "string",
      },
      step_3_generate_landing_page_json_shape: {
        headline: "string",
        subheadline: "string",
        ctaText: "string",
        benefits: [{ title: "string", description: "string" }],
        steps: [{ title: "string", description: "string" }],
        trustSection: "string",
        ctaSection: { headline: "string", subheadline: "string", ctaText: "string" },
      },
      rules: {
        never_use: [
          "limited time offer",
          "welcome to our service",
          "enhance your experience",
          "generic SaaS language",
        ],
        always: [
          "Make outcome CLEAR",
          "Make timeline CLEAR (time to first measurable result)",
          "Make process SIMPLE (3-step)",
          "Make CTA action-driven (not Submit/Continue)",
        ],
        headline_formulas_choose_one: [
          "Get [RESULT] in [TIMEFRAME] without [PAIN]",
          "Stop [PAIN] and start [RESULT] in [TIMEFRAME]",
          "Find [BEST OPTION] without [CONFUSION]",
          "Get [DESIRED RESULT] faster using [MECHANISM]",
        ],
      },
      constraints: [
        "Return a single JSON object with keys: step1, step2, step3.",
        "Use specific buyer language tied to targetAudience and goal; no generic promises.",
        "Do not claim guaranteed outcomes; use risk reversal that is operationally plausible.",
        "Benefits: 4-7 items. Steps: exactly 3 items.",
      ],
      required_json_shape: {
        step1: {
          dreamOutcome: "string",
          biggestPain: "string",
          fastestPath: "string",
          whyCurrentSolutionsFail: "string",
        },
        step2: {
          offerName: "string",
          mechanism: "string",
          timeToResult: "string",
          riskReversal: "string",
          whyDifferent: "string",
        },
        step3: {
          headline: "string",
          subheadline: "string",
          ctaText: "string",
          benefits: [{ title: "string", description: "string" }],
          steps: [{ title: "string", description: "string" }],
          trustSection: "string",
          ctaSection: { headline: "string", subheadline: "string", ctaText: "string" },
        },
      },
    },
    null,
    2,
  );
}

