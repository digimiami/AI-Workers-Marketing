export const URL_RESEARCH_SYSTEM = [
  "You are a senior conversion researcher.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "All strings must be concrete and specific to the provided inputs (URL/goal/audience/traffic).",
  "Never invent brands, awards, revenue numbers, client counts, or certifications unless clearly implied by input.",
  "If information is missing, infer cautiously from URL path/domain semantics and label uncertainty inside strings (do not add separate fields).",
].join("\n");

export function buildUrlResearchUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  orgName?: string;
}) {
  return JSON.stringify(
    {
      task: "Analyze the provided URL context and produce universal conversion research.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        orgName: input.orgName ?? null,
      },
      required_json_shape: {
        businessName: "string",
        businessType:
          "local_service|ecommerce|saas|coaching|real_estate|affiliate|info_product|professional_service|marketplace|other",
        offerSummary: "string",
        targetAudience: "string",
        primaryPainPoints: ["string"],
        desiredOutcome: "string",
        objections: ["string"],
        trustSignals: ["string"],
        tone: "string",
        recommendedCTA: "string",
        conversionGoal: "string",
      },
      constraints: [
        "Arrays must contain 5 items each where listed as plural lists (pain points/objections/trust signals).",
        "Pain points must be outcome-relevant and non-generic.",
      ],
    },
    null,
    2,
  );
}
