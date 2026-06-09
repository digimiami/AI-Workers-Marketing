export const LANDING_CUSTOMIZE_SYSTEM = [
  "You customize an existing landing page variant based on operator instructions.",
  "Return ONLY valid JSON matching required_json_shape. No markdown. No commentary.",
  "Preserve strong existing copy unless the instruction requires changing it.",
  "Honor explicit requests: lead forms (with requested fields), hero/product images, embedded video, campaign UTM tracking, email capture tracking.",
  "Use realistic placeholder image URLs only when no URL is provided: https://images.unsplash.com/photo-* with a relevant search theme, or leave imageUrl empty and describe alt text.",
  "For video, prefer YouTube/Vimeo embed URLs when the user mentions video.",
].join("\n");

export function buildLandingCustomizeUserPrompt(input: {
  instruction: string;
  currentContent: Record<string, unknown>;
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  requiredFeatures?: string[];
}) {
  return JSON.stringify(
    {
      task: "Apply operator customization to the landing variant JSON.",
      instruction: input.instruction,
      required_features: input.requiredFeatures ?? [],
      context: {
        url: input.url,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
      },
      current_content: input.currentContent,
      required_json_shape: {
        headline: "string",
        subheadline: "string",
        heroBadge: "string (optional)",
        ctaText: "string",
        trustLine: "string",
        benefits: [{ title: "string", description: "string" }],
        steps: [{ title: "string", description: "string" }],
        formFields: ["email|name|phone|company — subset, ordered"],
        media: {
          heroImageUrl: "string (optional)",
          images: [{ url: "string", alt: "string", caption: "string (optional)" }],
          videoUrl: "string (optional embed URL)",
          videoCaption: "string (optional)",
        },
        tracking: {
          campaign: "boolean — attach UTM + campaign id on form submit",
          email: "boolean — tag leads for email open/click tracking",
        },
        sections: [{ type: "section|image|video", title: "string", body: "string", bullets: ["string"], imageUrl: "string", videoUrl: "string" }],
        finalCTA: { headline: "string", subheadline: "string", ctaText: "string" },
      },
      rules: [
        "Keep benefits.length >= 4 and steps.length >= 3 unless instruction explicitly removes them.",
        "If user asks for a form, set formFields with at least email; add name/phone/company when requested.",
        "If user asks to track campaign, set tracking.campaign true.",
        "If user asks to track email, set tracking.email true.",
        "If user asks for picture/image/photo, add media.heroImageUrl or media.images or a section with type image.",
        "If user asks for video, set media.videoUrl or a section with type video.",
        "Do not invent fake certifications; keep copy anchored to the business URL context.",
      ],
    },
    null,
    2,
  );
}
