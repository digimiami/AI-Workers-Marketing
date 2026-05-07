import { buildOfferEngineUserPrompt, OFFER_ENGINE_SYSTEM } from "@/ai/prompts/offer_engine.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function generateOfferBundle(input: {
  businessAnalysis: Record<string, unknown> | null;
  targetAudience: string;
  goal: string;
  trafficSource: string;
}) {
  const fallbackJsonText = JSON.stringify({
    step1: {
      dreamOutcome: `A clear path to ${input.goal} without wasting time or budget.`,
      biggestPain: "Unclear next steps and low-signal leads that never convert.",
      fastestPath: "A single, specific promise + one-step lead capture + immediate follow-up sequence.",
      whyCurrentSolutionsFail: "They stay generic, ask for too much too soon, and fail to match intent from traffic.",
    },
    step2: {
      offerName: "Outcome-First Funnel Build",
      mechanism: "Intent-matched messaging + frictionless capture + fast follow-up",
      timeToResult: "First qualified leads within 7 days of launch (with traffic)",
      riskReversal: "Approve the copy + claims + budget before anything goes live.",
      whyDifferent: "Built from the URL + audience intent, not template language.",
    },
    step3: {
      headline: `Get ${input.goal} in 7 days without burning budget on unqualified clicks`,
      subheadline: "Answer 3 questions and we’ll route you to the fastest next step—offer, page, and follow-up aligned.",
      ctaText: "Build my offer",
      benefits: [
        { title: "Higher intent match", description: "Copy mirrors what your traffic is already searching for." },
        { title: "Fewer drop-offs", description: "Short form, clear next step, and friction removed." },
        { title: "Follow-up that converts", description: "Nurture sequence designed to push a decision, not a newsletter." },
        { title: "Proof-first structure", description: "Trust blocks built around real buyer objections and risk." },
      ],
      steps: [
        { title: "Diagnose", description: "We isolate the outcome your buyer wants and why they hesitate." },
        { title: "Build", description: "We generate the offer + page + ads that match your traffic intent." },
        { title: "Launch + learn", description: "We track results and recommend the next change based on data." },
      ],
      trustSection: "No hidden changes: approvals gate live spend, and every claim stays tied to your actual offer and page.",
      ctaSection: {
        headline: "Ready for a real conversion angle?",
        subheadline: "Get the offer, landing structure, and first ad angles in one pass.",
        ctaText: "Show me my angle",
      },
    },
  });

  const out = await runStrictJsonPrompt({
    system: OFFER_ENGINE_SYSTEM,
    user: buildOfferEngineUserPrompt({
      businessAnalysis: input.businessAnalysis,
      targetAudience: input.targetAudience,
      goal: input.goal,
      trafficSource: input.trafficSource,
    }),
    fallbackJsonText,
  });

  return { offer: safeParseRecord(out.jsonText), meta: out.meta };
}

