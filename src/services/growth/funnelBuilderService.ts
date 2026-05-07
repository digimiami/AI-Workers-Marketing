import { buildFunnelBuilderUserPrompt, FUNNEL_BUILDER_SYSTEM } from "@/ai/prompts/funnel_builder.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function buildFunnelBlueprint(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  urlResearch: Record<string, unknown> | null;
  classification: Record<string, unknown> | null;
}): Promise<Record<string, unknown>> {
  const fallbackJsonText = JSON.stringify({
    funnelName: "Core conversion path",
    funnelType: "direct_response",
    steps: [
      {
        stepNumber: 1,
        name: "Landing",
        type: "landing",
        purpose: "Match promise to traffic intent and qualify visitors quickly.",
        primaryCTA: "Continue",
        expectedUserAction: "Read + scroll to the form",
      },
      {
        stepNumber: 2,
        name: "Capture",
        type: "capture",
        purpose: "Collect the minimum viable lead data for follow-up.",
        primaryCTA: "Submit",
        expectedUserAction: "Submit email (and optional fields)",
      },
      {
        stepNumber: 3,
        name: "Thank you",
        type: "thank_you",
        purpose: "Confirm request + set expectations for next steps.",
        primaryCTA: "Next",
        expectedUserAction: "Read confirmation + take next step",
      },
    ],
    reasonForFlow: "Paid traffic needs a short path: promise → proof → capture → confirmation.",
    frictionPoints: ["Too many fields", "Unclear next step", "Weak headline match to ad"],
    optimizationTips: ["Reduce fields", "Repeat CTA after proof", "Align headline to ad keyword/theme"],
  });

  const out = await runStrictJsonPrompt({
    system: FUNNEL_BUILDER_SYSTEM,
    user: buildFunnelBuilderUserPrompt({
      url: input.url,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      urlResearch: input.urlResearch,
      classification: input.classification,
    }),
    fallbackJsonText,
  });
  return safeParseRecord(out.jsonText);
}
