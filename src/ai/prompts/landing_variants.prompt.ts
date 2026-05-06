export const LANDING_VARIANTS_SYSTEM = [
  "You generate 3 landing page variants with distinct angles.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
].join("\n");

export function buildLandingVariantsUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  baseLanding: Record<string, unknown> | null;
}) {
  return JSON.stringify(
    {
      task: "Produce 3 variants: direct_response, premium_trust, speed_convenience.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        baseLanding: input.baseLanding,
      },
      required_json_shape: {
        variants: [
          {
            variantKey: "direct_response|premium_trust|speed_convenience",
            angle: "string",
            headline: "string",
            subheadline: "string",
            ctaText: "string",
            benefits: [{ title: "string", description: "string" }],
            steps: [{ title: "string", description: "string" }],
            trustLine: "string",
            finalCTA: { headline: "string", subheadline: "string", ctaText: "string" },
          },
        ],
      },
      constraints: [
        "variants.length must be exactly 3.",
        "Each variantKey must be unique and match the three allowed keys.",
        "benefits: 4 items each; steps: 3 items each.",
      ],
    },
    null,
    2,
  );
}
