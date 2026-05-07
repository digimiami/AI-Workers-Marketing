export const FUNNEL_BUILDER_SYSTEM = [
  "You design simple, paid-traffic-safe conversion funnels.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Each step must have a clear purpose tied to the stated goal and audience.",
  "If the URL yields little signal, infer conservatively and keep copy concrete (no hype).",
].join("\n");

export function buildFunnelBuilderUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  urlResearch: Record<string, unknown> | null;
  classification: Record<string, unknown> | null;
}) {
  return JSON.stringify(
    {
      task: "Build a simple conversion funnel (max 6 steps) for the inputs.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        urlResearch: input.urlResearch,
        classification: input.classification,
      },
      required_json_shape: {
        funnelName: "string",
        funnelType: "string",
        steps: [
          {
            stepNumber: "number",
            name: "string",
            type: "landing|bridge|capture|cta|thank_you|nurture",
            purpose: "string",
            primaryCTA: "string",
            expectedUserAction: "string",
          },
        ],
        reasonForFlow: "string",
        frictionPoints: ["string"],
        optimizationTips: ["string"],
      },
      constraints: [
        "steps.length must be between 3 and 6 inclusive.",
        "stepNumber must be 1..n ascending with no gaps.",
        "First step type should usually be landing unless classification strongly suggests otherwise.",
        "Include a capture or clear commitment step before high-friction asks.",
        "frictionPoints: 3-6 items; optimizationTips: 3-6 items.",
      ],
    },
    null,
    2,
  );
}
