export const BUSINESS_BRIEF_SYSTEM = [
  "You extract a factual business brief from website text.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Do NOT invent facts. If something isn't in the text, leave it empty.",
].join("\n");

export function buildBusinessBriefUserPrompt(input: {
  url: string;
  content: string;
  goal: string;
  audience: string;
  trafficSource: string;
}) {
  const contentExcerpt = String(input.content ?? "").slice(0, 12000);
  return JSON.stringify(
    {
      task: "Extract a business brief grounded in the provided content_excerpt.",
      inputs: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
        content_excerpt: contentExcerpt,
      },
      required_json_shape: {
        business_name: "string|null",
        person_name: "string|null",
        locations: ["string"],
        offer_summary: "string",
        offers: ["string"],
        service_lines: ["string"],
        audience_signals: ["string"],
        proof: {
          testimonials_present: "boolean",
          years_in_business: "string|null",
          stats: ["string"],
          awards: ["string"],
        },
        cta_verbs_on_site: ["string"],
        key_terms: ["string"],
        forbidden_positioning: ["string"],
      },
      constraints: [
        "key_terms must be 10–25 terms found verbatim in content_excerpt; avoid generic marketing terms (business, platform, workflow, AI, solutions).",
        "offer_summary must be a single sentence using nouns from content_excerpt.",
        "forbidden_positioning must list what this is NOT (e.g. 'not a generic AI marketing platform') if the text could be misread.",
      ],
    },
    null,
    2,
  );
}

