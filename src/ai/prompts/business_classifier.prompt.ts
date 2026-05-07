export const BUSINESS_CLASSIFIER_SYSTEM = [
  "You classify businesses and recommend the best conversion path for paid traffic.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Do not invent credentials, awards, revenue, or customer counts.",
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
      task: "Classify the business and determine the best conversion path.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        urlResearch: input.urlResearch ?? null,
      },
      required_json_shape: {
        classification: "string",
        confidence: "number",
        bestFunnelType:
          "lead_magnet|consultation|quiz|product_offer|free_trial|demo_booking|affiliate_bridge|webinar|direct_response",
        bestTrafficSources: ["string"],
        recommendedLeadCapture: ["string"],
        riskNotes: ["string"],
      },
      constraints: [
        "confidence must be between 0 and 1.",
        "bestTrafficSources: 3-6 concrete channels (e.g., google_search, meta_feed, youtube_instream).",
        "recommendedLeadCapture: 2-5 practical fields or mechanisms (not vague).",
        "riskNotes: 2-5 compliance/positioning/execution risks specific to this offer.",
      ],
    },
    null,
    2,
  );
}
