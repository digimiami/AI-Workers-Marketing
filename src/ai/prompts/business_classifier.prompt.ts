export const BUSINESS_CLASSIFIER_SYSTEM = [
  "You classify businesses from inputs.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
].join("\n");

export function buildBusinessClassifierUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  urlResearch?: Record<string, unknown>;
}) {
  return JSON.stringify(
    {
      task: "Classify the business model based on URL signals + stated inputs.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        urlResearch: input.urlResearch ?? null,
      },
      required_json_shape: {
        classification:
          "service|saas|ecommerce|affiliate|info_product|local_service|marketplace|professional_service|coaching|real_estate|other",
        confidence: "number",
        rationale: "string",
        primaryOfferHypothesis: "string",
        disqualifiers: ["string"],
      },
      constraints: ["confidence must be between 0 and 1."],
    },
    null,
    2,
  );
}
