import { buildUrlResearchUserPrompt, URL_RESEARCH_SYSTEM } from "@/ai/prompts/url_research.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function analyzeUrlResearch(input: {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  orgName?: string | null;
}): Promise<Record<string, unknown>> {
  const fallbackJsonText = JSON.stringify({
    businessName: "Unknown business",
    businessType: "other",
    offerSummary: `Help ${input.audience} achieve: ${input.goal} (URL signals were limited).`,
    targetAudience: input.audience,
    primaryPainPoints: [
      "Time wasted on unclear next steps",
      "Hard to compare options confidently",
      "Uncertainty about fit and outcomes",
      "Friction getting started",
      "Risk of choosing the wrong path",
    ],
    desiredOutcome: input.goal,
    objections: [
      "Is this credible for my situation?",
      "What exactly happens after I click?",
      "How long until I see results?",
      "Is pricing transparent?",
      "What if it does not work for me?",
    ],
    trustSignals: [
      "Clear explanation of the process",
      "Specific language tied to the audience",
      "Concrete next steps after opt-in",
      "No exaggerated claims in copy",
      "Privacy-conscious lead capture",
    ],
    tone: "Direct, specific, and calm",
    recommendedCTA: "Get the shortlist + next steps",
    conversionGoal: input.goal,
  });

  const out = await runStrictJsonPrompt({
    system: URL_RESEARCH_SYSTEM,
    user: buildUrlResearchUserPrompt({
      url: input.url,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      orgName: input.orgName ?? undefined,
    }),
    fallbackJsonText,
  });
  return safeParseRecord(out.jsonText);
}
