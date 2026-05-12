export const LANDING_VARIANTS_SYSTEM = [
  "You are a Visual AI Conversion Engine: you produce three DISTINCT landing variants (angles), not a generic site builder.",
  "Each variant must feel niche-native: palette/typography mood, copy rhythm, CTA psychology, and trust architecture must match the business implied by content_excerpt and url — never reuse the same layout story across unrelated industries.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Never output placeholder copy, template SaaS filler, or repeated card walls. Prefer scanning hierarchy, whitespace, and one clear primary action per screenful.",
].join("\n");

export function buildLandingVariantsUserPrompt(input: {
  url: string;
  content: string;
  goal: string;
  audience: string;
  trafficSource: string;
  baseLanding: Record<string, unknown> | null;
}) {
  const contentExcerpt = String(input.content ?? "").slice(0, 6000);
  return JSON.stringify(
    {
      task: "Produce 3 variants: direct_response, premium_trust, speed_convenience.",
      inputs: {
        url: input.url,
        content_excerpt: contentExcerpt,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        baseLanding: input.baseLanding,
      },
      required_json_shape: {
        variants: [
          {
            variantLabel: "A|B|C",
            variantKey: "direct_response|premium_trust|speed_convenience",
            angle: "string",
            visualIdentity: {
              paletteHint: "string (2–4 colors + usage, niche-specific, e.g. luxury neutrals / bold trade contrast / clinical soft blues)",
              typographyHint: "string (headline/body vibe: serif luxury, bold trade sans, calm medical readable, etc.)",
              mood: "string (one line: authoritative, urgent, reassuring, premium, high-energy, etc.)",
            },
            headline: "string",
            subheadline: "string",
            heroBadge: "string (optional): one short line — locality, segment, or specialty from the page (e.g. 'Central Florida · Buyer + Seller strategy'). Omit if nothing specific.",
            ctaText: "string",
            trustLine: "string",
            benefits: [{ title: "string", description: "string" }],
            steps: [{ title: "string", description: "string" }],
            offer: {
              title: "string (optional)",
              bullets: ["string"],
              valueStack: [{ label: "string", value: "string" }],
            },
            socialProof: {
              proofPoints: ["string"],
              testimonials: [{ name: "string", role: "string", quote: "string" }],
            },
            objections: [{ question: "string", answer: "string" }],
            faq: [{ question: "string", answer: "string" }],
            guarantee: { headline: "string", body: "string" },
            sections: [
              {
                type: "section",
                title: "string",
                body: "string (optional)",
                bullets: ["string (optional)"],
              },
            ],
            formFields: ["string"],
            psychologicalTrigger: "string",
            finalCTA: { headline: "string", subheadline: "string", ctaText: "string" },
          },
        ],
      },
      constraints: [
        "variants.length must be exactly 3.",
        "Map labels: A=direct_response, B=premium_trust, C=speed_convenience (variantKey must match).",
        "Each variantKey must be unique and match the three allowed keys.",
        "benefits: 4 items each; steps: 3 items each.",
        "visualIdentity is REQUIRED per variant and must differ by angle (e.g. direct_response can be higher contrast; premium_trust warmer editorial; speed_convenience cleaner, tighter).",
        "CTA ENGINE: hero ctaText and finalCTA.ctaText must be outcome-specific, first-person where natural (my/I), and NEVER generic labels like: Learn more, Get started, Submit, Continue, Click here, Read more, Sign up, Contact us (as the whole button), Try now alone.",
        "Traffic temperature: infer from trafficSource + goal. Cold traffic → more education, proof, softer secondary asks; hot/retargeting → shorter blocks, stronger urgency, bolder CTA — still no spam clichés.",
        "Trust engine: align proof to vertical (e.g. licensed/insured for trades; response time and local expertise for real estate; credentials/wait time clarity for medical). Do not invent licenses or awards not implied by excerpt.",
        "Section strategy: pick 2–4 sections that fit THIS niche (hero story, process, proof, offer stack, objections, comparison, urgency only when honest). Avoid duplicate section intents.",
        "Copy must sound handcrafted for THIS brand: concrete nouns from content_excerpt, real offer shapes, no meaningless AI-SaaS abstractions ('transform your business', 'boost your growth', 'unlock potential').",
        "socialProof: include testimonial quotes only when excerpt implies real reviews; otherwise proofPoints with specific outcomes or numbers from the page (no invented star ratings).",
        "formFields must be a subset ordered from [email,name,phone,company] (practical for paid traffic; prefer shortest viable form).",
        "psychologicalTrigger must name the persuasion pattern in plain language (clarity, risk reversal, social proof, urgency with integrity — no manipulation playbook).",
        "Mobile-first: imply concise blocks, thumb-friendly primary CTA, avoid walls of text; sections should be scannable.",
        "Unless the URL is aiworkers.vip or aiworkers.com, never name or promote AiWorkers — write for the business at the URL.",
      ],
    },
    null,
    2,
  );
}
