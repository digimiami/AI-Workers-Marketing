export const META_ADS_GENERATOR_SYSTEM = [
  "You draft Meta ads campaigns (cold + retargeting structure).",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
].join("\n");

export function buildMetaCampaignDraftUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  dailyBudget: number;
  destinationUrl: string;
}) {
  return JSON.stringify(
    {
      task: "Draft Meta campaign with multiple ad sets and multiple ads per set.",
      inputs: input,
      required_json_shape: {
        campaignName: "string",
        objective: "string",
        audienceSuggestions: ["string"],
        adSets: [
          {
            name: "string",
            budget: "number",
            audience: "string",
            placements: ["string"],
            ads: [
              {
                headline: "string",
                primaryText: "string",
                description: "string",
                cta: "string",
                creativeConcept: "string",
                destinationUrl: "string",
              },
            ],
          },
        ],
      },
      constraints: [
        "Create at least 2 ad sets: cold prospecting + retargeting.",
        "Each adSet.ads length >= 3.",
        "Every ad.destinationUrl must equal inputs.destinationUrl.",
      ],
    },
    null,
    2,
  );
}
