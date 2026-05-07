export const TRAFFIC_ROUTER_SYSTEM = [
  "You route paid and organic traffic to the best landing variant.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Variants A/B/C map to: A=direct response, B=trust/authority, C=speed/convenience.",
  "When performance data is missing or sparse, prefer even split or conservative routing.",
].join("\n");

export function buildTrafficRouterUserPrompt(input: {
  trafficSource: string;
  device: string;
  intentLevel: "low" | "medium" | "high" | "unknown";
  location?: string | null;
  userBehavior?: Record<string, unknown> | null;
  variantPerformance?: Record<string, unknown> | null;
}) {
  return JSON.stringify(
    {
      task: "Select the best landing variant for this visit context.",
      inputs: {
        trafficSource: input.trafficSource,
        device: input.device,
        intentLevel: input.intentLevel,
        location: input.location ?? null,
        userBehavior: input.userBehavior ?? null,
        variantPerformance: input.variantPerformance ?? null,
      },
      required_json_shape: {
        selectedVariant: "A|B|C",
        reason: "string",
        confidenceScore: "number",
        fallbackVariant: "A|B|C",
        routingRule: "string",
      },
      constraints: [
        "confidenceScore must be between 0 and 1.",
        "High intent → prefer A unless performance strongly favors another variant.",
        "Cold / low intent → prefer B unless device is mobile and performance favors C.",
        "Mobile → prefer C when copy length or speed is the constraint; otherwise follow intent rules.",
        "If variantPerformance is empty or inconclusive, choose A and set routingRule to even_split_default.",
      ],
    },
    null,
    2,
  );
}
