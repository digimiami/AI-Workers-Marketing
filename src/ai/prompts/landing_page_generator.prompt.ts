export const LANDING_PAGE_GENERATOR_SYSTEM = [
  "You write high-converting landing page copy.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Avoid vague hype phrases and generic positioning.",
  "Headline must be outcome-specific; subheadline must explain what happens next.",
].join("\n");

export function buildLandingPageGeneratorUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  urlResearch: Record<string, unknown> | null;
  funnelStrategy: Record<string, unknown> | null;
}) {
  return JSON.stringify(
    {
      task: "Generate landing page copy using sharp, concrete language tied to inputs.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        urlResearch: input.urlResearch,
        funnelStrategy: input.funnelStrategy,
      },
      headline_formula_examples: [
        "Get [desired result] in [timeframe] without [pain]",
        "Find [best option] faster without [bad process]",
        "Stop [pain] and start [desired outcome]",
        "Get matched with [solution] without [confusion]",
      ],
      required_json_shape: {
        headline: "string",
        subheadline: "string",
        ctaText: "string",
        trustLine: "string",
        benefits: [{ title: "string", description: "string" }],
        steps: [{ title: "string", description: "string" }],
        formFields: ["email", "name", "phone"],
        finalCTA: { headline: "string", subheadline: "string", ctaText: "string" },
      },
      constraints: [
        "benefits must be 4 items.",
        "steps must be 3 items.",
        "formFields must be a subset ordering from allowed list (keep practical for paid traffic).",
      ],
    },
    null,
    2,
  );
}
