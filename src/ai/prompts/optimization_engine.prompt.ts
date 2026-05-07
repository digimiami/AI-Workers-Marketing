export const OPTIMIZATION_ENGINE_SYSTEM = [
  "You recommend growth optimizations across landing pages, ads, and follow-up.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Never authorize live budget increases unless autopilotEnabled is explicitly true.",
].join("\n");

export function buildOptimizationEngineUserPrompt(input: {
  campaignName: string;
  autopilotEnabled: boolean;
  metrics: Record<string, unknown>;
  funnelSummary: Record<string, unknown> | null;
}) {
  return JSON.stringify(
    {
      task: "Review performance and recommend prioritized actions.",
      inputs: {
        campaignName: input.campaignName,
        autopilotEnabled: input.autopilotEnabled,
        metrics: input.metrics,
        funnelSummary: input.funnelSummary,
      },
      required_json_shape: {
        summary: "string",
        winners: ["string"],
        losers: ["string"],
        recommendations: [
          {
            priority: "high|medium|low",
            action: "string",
            reason: "string",
            expectedImpact: "string",
          },
        ],
        suggestedActions: [
          {
            type:
              "pause_ad|create_variant|increase_budget|rewrite_copy|improve_landing|follow_up_leads",
            description: "string",
            requiresApproval: "boolean",
          },
        ],
      },
      constraints: [
        "recommendations: 4-8 items.",
        "suggestedActions: 4-10 items.",
        "If autopilotEnabled=false, any increase_budget action must set requiresApproval=true.",
        "Low CTR → recommend rewrite_copy or create_variant.",
        "High clicks, low leads → improve_landing.",
        "High CPL → create_variant or pause_ad on losers.",
      ],
    },
    null,
    2,
  );
}
