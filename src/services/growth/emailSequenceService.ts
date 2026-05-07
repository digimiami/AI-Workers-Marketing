import { buildEmailSequenceUserPrompt, EMAIL_SEQUENCE_GENERATOR_SYSTEM } from "@/ai/prompts/email_sequence_generator.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function generateEmailSequenceNurture(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
}): Promise<Record<string, unknown>> {
  const delays = [0, 1440, 4320, 10080, 20160];
  const fallbackJsonText = JSON.stringify({
    sequenceName: `Follow-up: ${input.goal}`.slice(0, 120),
    emails: delays.map((delayMinutes, i) => ({
      step: i + 1,
      delayMinutes,
      subject:
        i === 0
          ? `Here’s what you asked for (${input.goal})`
          : i === 1
            ? "The hidden cost of waiting"
            : i === 2
              ? "What actually works (without the hype)"
              : i === 3
                ? "A quick objection check"
                : "Your best next step",
      previewText: `Built for ${input.audience} — step ${i + 1} of 5.`,
      body:
        i === 0
          ? `Thanks for your interest.\n\nYou wanted: ${input.goal}.\nHere’s the fastest way to move forward without wasting time.\n\nSource context: ${input.url}`
          : `This email continues the story for ${input.audience}. Keep it specific to your offer and proof.\n\nGoal anchor: ${input.goal}.`,
      cta: i === 4 ? "Book / reply with your timeline" : "Reply with your #1 constraint",
    })),
  });

  const out = await runStrictJsonPrompt({
    system: EMAIL_SEQUENCE_GENERATOR_SYSTEM,
    user: buildEmailSequenceUserPrompt({
      url: input.url,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
    }),
    fallbackJsonText,
  });
  return safeParseRecord(out.jsonText);
}
