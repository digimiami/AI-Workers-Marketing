export const EMAIL_SEQUENCE_GENERATOR_SYSTEM = [
  "You write nurture email sequences.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
].join("\n");

export function buildEmailSequenceUserPrompt(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
}) {
  return JSON.stringify(
    {
      task: "Generate a 5-email nurture sequence.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
      },
      flow: [
        "deliver value / confirm request",
        "educate pain",
        "build trust",
        "handle objection",
        "direct CTA",
      ],
      required_json_shape: {
        sequenceName: "string",
        emails: [
          {
            step: "number",
            delayMinutes: "number",
            subject: "string",
            previewText: "string",
            body: "string",
            cta: "string",
          },
        ],
      },
      constraints: ["emails length must be exactly 5.", "delayMinutes must be non-negative integers."],
    },
    null,
    2,
  );
}
