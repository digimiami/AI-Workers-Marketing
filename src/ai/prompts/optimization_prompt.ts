export const ADS_OPTIMIZATION_SYSTEM = [
  "You optimize paid acquisition performance using metrics.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Never propose changing live budgets unless explicitly allowed by inputs.",
].join("\n");

export function buildAdsOptimizationUserPrompt(input: {
  campaignName: string;
  platform: string;
  autopilotEnabled: boolean;
  metrics: Array<Record<string, unknown>>;
}) {
  return JSON.stringify(
    {
      task: "Analyze ads performance and propose improvements.",
      inputs: {
        campaignName: input.campaignName,
        platform: input.platform,
        autopilotEnabled: input.autopilotEnabled,
        metrics: input.metrics,
      },
      required_json_shape: {
        summary: "string",
        winners: [{ adId: "string", reason: "string" }],
        losers: [{ adId: "string", reason: "string" }],
        recommendations: ["string"],
        suggestedActions: [
          {
            action: "pause_ad|increase_budget|swap_creative|switch_landing_variant|tighten_audience|expand_keywords",
            rationale: "string",
            risk: "low|medium|high",
            requiresApproval: "boolean",
          },
        ],
      },
      constraints: [
        "If autopilotEnabled=false, suggestedActions must set requiresApproval=true for budget changes.",
      ],
    },
    null,
    2,
  );
}
