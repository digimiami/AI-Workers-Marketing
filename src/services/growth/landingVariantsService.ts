import { buildLandingVariantsUserPrompt, LANDING_VARIANTS_SYSTEM } from "@/ai/prompts/landing_variants.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function generateLandingVariants(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  baseLanding: Record<string, unknown> | null;
}): Promise<Record<string, unknown>> {
  const fallbackJsonText = JSON.stringify({
    variants: [
      {
        variantLabel: "A",
        variantKey: "direct_response",
        angle: "Direct response",
        headline: `Get clarity on ${input.goal} without guesswork`,
        subheadline: "Tell us what you need — we’ll show the fastest next step.",
        ctaText: "Get the plan",
        trustLine: "Built for busy buyers who hate fluff.",
        benefits: Array.from({ length: 4 }).map((_, i) => ({
          title: `Outcome ${i + 1}`,
          description: `A concrete benefit aligned to ${input.goal}.`,
        })),
        steps: Array.from({ length: 3 }).map((_, i) => ({
          title: `Step ${i + 1}`,
          description: "A simple action that moves you forward.",
        })),
        formFields: ["email", "name"],
        psychologicalTrigger: "Clarity + control (reduce uncertainty)",
        finalCTA: {
          headline: "Ready to move?",
          subheadline: "Submit your email and we’ll send the next step.",
          ctaText: "Send my next step",
        },
      },
      {
        variantLabel: "B",
        variantKey: "premium_trust",
        angle: "Trust / authority",
        headline: `A safer way to choose the right path for ${input.audience}`,
        subheadline: "See how the process works before you commit time.",
        ctaText: "See how it works",
        trustLine: "Plain-language explanation. No mystery mechanics.",
        benefits: Array.from({ length: 4 }).map((_, i) => ({
          title: `Proof point ${i + 1}`,
          description: "A credibility-oriented benefit tied to the offer.",
        })),
        steps: Array.from({ length: 3 }).map((_, i) => ({
          title: `Step ${i + 1}`,
          description: "Build confidence with specifics.",
        })),
        formFields: ["email"],
        psychologicalTrigger: "Risk reduction (explain the mechanism)",
        finalCTA: {
          headline: "Prefer proof before speed?",
          subheadline: "Get the breakdown in your inbox.",
          ctaText: "Email me the breakdown",
        },
      },
      {
        variantLabel: "C",
        variantKey: "speed_convenience",
        angle: "Speed / convenience",
        headline: `Get matched faster — built for ${input.trafficSource} traffic`,
        subheadline: "Short page. Fast form. Clear next step.",
        ctaText: "Continue",
        trustLine: "Optimized for mobile skimmers.",
        benefits: Array.from({ length: 4 }).map((_, i) => ({
          title: `Fast win ${i + 1}`,
          description: "A benefit framed around speed and simplicity.",
        })),
        steps: Array.from({ length: 3 }).map((_, i) => ({
          title: `Step ${i + 1}`,
          description: "Keep momentum; remove extra decisions.",
        })),
        formFields: ["email"],
        psychologicalTrigger: "Momentum (reduce friction)",
        finalCTA: {
          headline: "In a hurry?",
          subheadline: "One field. One click. Next step delivered.",
          ctaText: "Continue",
        },
      },
    ],
  });

  const out = await runStrictJsonPrompt({
    system: LANDING_VARIANTS_SYSTEM,
    user: buildLandingVariantsUserPrompt({
      url: input.url,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      baseLanding: input.baseLanding,
    }),
    fallbackJsonText,
  });
  return safeParseRecord(out.jsonText);
}
