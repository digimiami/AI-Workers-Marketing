export const LANDING_PAGE_GENERATOR_SYSTEM = [
  "You are a direct response copywriter + conversion expert.",
  "Your job is NOT to write generic landing pages.",
  "Return ONLY valid JSON matching the required schema. No markdown. No code fences. No commentary.",
  "Do not use placeholders. Do not use vague generic marketing words. Do not repeat the same phrases.",
  "Be outcome-driven, specific, and persuasive. Sound like a real business.",
].join("\n");

export function buildLandingPageGeneratorUserPrompt(input: {
  url: string;
  content: string;
  businessBrief?: Record<string, unknown> | null;
  goal: string;
  audience: string;
  trafficSource: string;
  urlResearch: Record<string, unknown> | null;
  funnelStrategy: Record<string, unknown> | null;
}) {
  const contentExcerpt = String(input.content ?? "").slice(0, 8000);
  return JSON.stringify(
    {
      task: "Analyze URL context and rewrite as a high-converting landing page.",
      inputs: {
        url: input.url,
        content_excerpt: contentExcerpt,
        business_brief: input.businessBrief ?? null,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        urlResearch: input.urlResearch,
        funnelStrategy: input.funnelStrategy,
      },
      rules: {
        step1_understand_business: [
          "Use business_brief as the source of truth for names, locations, offers, and key_terms.",
          "From the provided content_excerpt, extract what is being sold, who it is for, what problem is solved, what result is promised.",
          "You MUST use the business/product/brand language found in content_excerpt (names, product terms, offers).",
          "Do NOT guess generically. If uncertain, be explicit in the copy without adding extra fields.",
        ],
        step2_strong_offer: [
          "Rewrite the offer into a clear outcome + fast benefit + specific transformation.",
          "Bad: 'generic value statement with no mechanism' | Good: 'Get 20–50 qualified leads per month without hiring a marketing team'",
        ],
        step3_conversion_structure: [
          "Headline: outcome-driven and specific",
          "Subheadline: explain HOW and WHO it's for",
          "Benefits: 4 real benefits (no placeholders, no vague fluff)",
          "How it works: 3 believable steps (user does, system does, result)",
          "Trust: credibility + reassurance + risk reduction (no invented certifications/awards)",
          "CTA: ACTION + RESULT (no 'Submit')",
          "Lead capture hook: what they receive + how fast + why it matters",
        ],
        banned: [
          "placeholders like 'Benefit 1' or 'Step 1'",
          "generic phrases like 'unlock your dream', 'step into your future' unless URL context explicitly supports it",
          "vague claims without mechanism",
          "generic phrases like 'boost your business', 'limited time offer', 'AI solutions', 'grow faster' (rewrite if detected)",
          "Unless the URL hostname is aiworkers.vip (or aiworkers.com), do NOT name or promote 'AiWorkers' — write for the business at the provided URL only.",
        ],
      },
      required_json_shape: {
        headline: "string",
        subheadline: "string",
        benefits: ["string", "string", "string", "string"],
        steps: ["string", "string", "string"],
        cta: "string",
        lead_hook: "string",
        trust: "string",
      },
      constraints: [
        "Return STRICT JSON only with the required keys.",
        "benefits must be exactly 4 strings; each must be specific and remove a real pain point.",
        "steps must be exactly 3 strings; each must be simple, believable, and outcome-linked.",
        "cta must be ACTION + RESULT and short enough for a button.",
        "trust must reassure without inventing facts.",
        "headline OR subheadline must include a concrete brand/product term from content_excerpt (not generic 'local business' templates).",
      ],
    },
    null,
    2,
  );
}
