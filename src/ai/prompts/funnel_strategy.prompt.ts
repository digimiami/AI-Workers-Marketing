export const FUNNEL_STRATEGY_SYSTEM = [
  "You are a funnel strategist.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Choose steps appropriate for the classification + conversion goal.",
].join("\n");

export function buildFunnelStrategyUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  classification: Record<string, unknown> | null;
  urlResearch: Record<string, unknown> | null;
}) {
  return JSON.stringify(
    {
      task: "Choose the best funnel type and outline steps + strategies.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        classification: input.classification,
        urlResearch: input.urlResearch,
      },
      funnelTypesAllowed: [
        "lead_magnet",
        "consultation",
        "quiz",
        "product_offer",
        "free_trial",
        "demo_booking",
        "affiliate_bridge",
        "webinar",
        "direct_response",
      ],
      required_json_shape: {
        funnelType: "string",
        reason: "string",
        steps: [
          {
            pageType: "string",
            purpose: "string",
            cta: "string",
            expectedUserAction: "string",
          },
        ],
        trafficStrategy: "string",
        conversionStrategy: "string",
      },
      constraints: [
        "steps should usually be 2-5 steps and map to realistic paid traffic behavior.",
        "Prefer a ClickFunnels-style minimal lead flow by default: landing -> thank_you. Add bridge only for cold traffic or high-friction offers.",
        "Avoid splitting lead capture into a separate page unless there's a strong reason; embed the form on the landing page when possible.",
      ],
    },
    null,
    2,
  );
}
