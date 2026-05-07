export const FUNNEL_VISUALIZER_SYSTEM = [
  "You diagnose funnel performance from step metrics.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "If metrics are missing, use zeros and explain uncertainty in overview text.",
].join("\n");

export function buildFunnelVisualizerUserPrompt(input: {
  campaignName: string;
  steps: Array<Record<string, unknown>>;
}) {
  return JSON.stringify(
    {
      task: "Summarize funnel health and per-step diagnostics.",
      inputs: {
        campaignName: input.campaignName,
        steps: input.steps,
      },
      required_json_shape: {
        overview: "string",
        steps: [
          {
            stepName: "string",
            visitors: "number",
            conversions: "number",
            dropOffRate: "number",
            problem: "string",
            suggestion: "string",
          },
        ],
        biggestLeak: "string",
        optimizationPriority: "string",
      },
      constraints: [
        "dropOffRate must be between 0 and 1 (ratio), not percent, unless visitors=0 then 0.",
        "steps array must mirror input steps order when possible.",
      ],
    },
    null,
    2,
  );
}
