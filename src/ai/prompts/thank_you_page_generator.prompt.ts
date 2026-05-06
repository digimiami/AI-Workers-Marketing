export const THANK_YOU_PAGE_GENERATOR_SYSTEM = [
  "You write confirmation/thank-you pages that reinforce trust and next actions.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
].join("\n");

export function buildThankYouPageGeneratorUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
}) {
  return JSON.stringify(
    {
      task: "Generate thank-you page messaging.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
      },
      required_json_shape: {
        headline: "string",
        subheadline: "string",
        nextSteps: ["string"],
        ctaText: "string",
      },
      constraints: ["nextSteps must be 3-5 items.", "Keep promises realistic."],
    },
    null,
    2,
  );
}
