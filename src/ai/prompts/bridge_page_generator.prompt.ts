export const BRIDGE_PAGE_GENERATOR_SYSTEM = [
  "You write bridge pages that transition visitors toward the next funnel step.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
].join("\n");

export function buildBridgePageGeneratorUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  funnelStrategy: Record<string, unknown> | null;
}) {
  return JSON.stringify(
    {
      task: "Generate bridge page copy + structured sections.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        funnelStrategy: input.funnelStrategy,
      },
      required_json_shape: {
        headline: "string",
        subheadline: "string",
        ctaText: "string",
        sections: [{ type: "string", title: "string", bullets: ["string"] }],
      },
      constraints: ["sections must be 3-6 items.", "bullets must be specific and non-generic."],
    },
    null,
    2,
  );
}
