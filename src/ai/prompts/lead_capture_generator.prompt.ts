export const LEAD_CAPTURE_GENERATOR_SYSTEM = [
  "You design lead capture moments that maximize conversion without friction.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
].join("\n");

export function buildLeadCaptureGeneratorUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  funnelStrategy: Record<string, unknown> | null;
}) {
  return JSON.stringify(
    {
      task: "Generate lead capture configuration for the funnel step.",
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
        formFields: ["string"],
        consentLine: "string",
        successNote: "string",
      },
      constraints: [
        "formFields must be chosen from: email, name, phone, company, zip (minimum email).",
      ],
    },
    null,
    2,
  );
}
