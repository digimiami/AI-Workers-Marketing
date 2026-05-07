export const LANDING_VARIANTS_SYSTEM = [
  "You generate 3 landing page variants with distinct angles.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
].join("\n");

export function buildLandingVariantsUserPrompt(input: {
  url: string;
  content: string;
  goal: string;
  audience: string;
  trafficSource: string;
  baseLanding: Record<string, unknown> | null;
}) {
  const contentExcerpt = String(input.content ?? "").slice(0, 6000);
  return JSON.stringify(
    {
      task: "Produce 3 variants: direct_response, premium_trust, speed_convenience.",
      inputs: {
        url: input.url,
        content_excerpt: contentExcerpt,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        baseLanding: input.baseLanding,
      },
      required_json_shape: {
        variants: [
          {
            variantLabel: "A|B|C",
            variantKey: "direct_response|premium_trust|speed_convenience",
            angle: "string",
            headline: "string",
            subheadline: "string",
            ctaText: "string",
            trustLine: "string",
            benefits: [{ title: "string", description: "string" }],
            steps: [{ title: "string", description: "string" }],
            formFields: ["string"],
            psychologicalTrigger: "string",
            finalCTA: { headline: "string", subheadline: "string", ctaText: "string" },
          },
        ],
      },
      constraints: [
        "variants.length must be exactly 3.",
        "Map labels: A=direct_response, B=premium_trust, C=speed_convenience (variantKey must match).",
        "Each variantKey must be unique and match the three allowed keys.",
        "benefits: 4 items each; steps: 3 items each.",
        "formFields must be a subset ordered from [email,name,phone,company] (practical for paid traffic).",
        "psychologicalTrigger must name the persuasion pattern in plain language (no manipulation tactics).",
        "Avoid generic phrases; anchor copy to the specific brand/product language found in content_excerpt.",
        "Unless the URL is aiworkers.vip or aiworkers.com, never name or promote AiWorkers — write for the business at the URL.",
      ],
    },
    null,
    2,
  );
}
