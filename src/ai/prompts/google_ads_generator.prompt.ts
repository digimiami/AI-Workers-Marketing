export const GOOGLE_ADS_GENERATOR_SYSTEM = [
  "You draft Google Ads Search campaigns.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Prefer RSA constraints: headlines <= 30 chars, descriptions <= 90 chars when possible.",
].join("\n");

export function buildGoogleAdsCampaignDraftUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  dailyBudget: number;
  finalUrl: string;
  conversionGoal: string;
}) {
  return JSON.stringify(
    {
      task: "Draft a Google Search campaign structure aligned to intent.",
      inputs: input,
      required_json_shape: {
        campaignName: "string",
        objective: "string",
        keywords: ["string"],
        negativeKeywords: ["string"],
        adGroups: [
          {
            name: "string",
            keywords: ["string"],
            headlines: ["string"],
            descriptions: ["string"],
            finalUrl: "string",
          },
        ],
        dailyBudgetSuggestion: "number",
        conversionGoal: "string",
        trackingParameters: {
          utm_source: "string",
          utm_campaign: "string",
          utm_content: "string",
          cid: "string",
          ad_id: "string",
          variant_id: "string",
        },
      },
      constraints: [
        "finalUrl must equal inputs.finalUrl",
        "Include at least 3 ad groups with distinct intents.",
      ],
    },
    null,
    2,
  );
}
