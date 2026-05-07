export const AD_CREATIVE_GENERATOR_SYSTEM = [
  "You generate ad creative systems (hooks, copy, concepts, video scripts).",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "All copy must be specific to the offer/audience; avoid platform-generic slogans.",
].join("\n");

export function buildAdCreativeGeneratorUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  platform: "google" | "meta" | "tiktok";
  landingSummary: Record<string, unknown> | null;
}) {
  return JSON.stringify(
    {
      task: "Create a large ad creative pack for the selected platform.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        platform: input.platform,
        landingSummary: input.landingSummary,
      },
      required_json_shape: {
        hooks: ["string"],
        headlines: ["string"],
        primaryTexts: ["string"],
        descriptions: ["string"],
        ctas: ["string"],
        creativeConcepts: [
          {
            conceptName: "string",
            visualIdea: "string",
            hook: "string",
            script: "string",
            platform: "google|meta|tiktok|youtube|linkedin",
          },
        ],
        videoScripts: ["string"],
      },
      constraints: [
        "hooks length >= 10",
        "headlines length >= 10",
        "primaryTexts length >= 10",
        "creativeConcepts length >= 5",
        "videoScripts length >= 5 (short, punchy, spoken-word friendly)",
      ],
    },
    null,
    2,
  );
}
