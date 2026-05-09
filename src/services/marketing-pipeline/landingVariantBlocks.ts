/**
 * Build structured `blocks[]` for `landing_page_variants.content` from AI variant JSON.
 * Shared by the marketing pipeline and landing regeneration so public `/f/...` always has blocks.
 */

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function buildLandingVariantBlocks(v: Record<string, unknown>): unknown[] {
  const sections = Array.isArray(v.sections) ? (v.sections as unknown[]).map((s) => asRecord(s)) : [];
  const secBlocks = sections.map((s) => ({
    type: String(s.type || "section"),
    title: typeof s.title === "string" ? s.title : undefined,
    bullets: Array.isArray(s.bullets) ? (s.bullets as unknown[]).filter((x): x is string => typeof x === "string") : undefined,
    body: typeof s.body === "string" ? s.body : undefined,
    items: Array.isArray(s.items) ? s.items : undefined,
  }));

  const benefitsArr = Array.isArray(v.benefits) ? (v.benefits as unknown[]).map((b) => asRecord(b)) : [];
  const stepsArr = Array.isArray(v.steps) ? (v.steps as unknown[]).map((b) => asRecord(b)) : [];
  const offer = asRecord((v as { offer?: unknown }).offer);
  const socialProof = asRecord((v as { socialProof?: unknown }).socialProof);
  const objectionsArr = Array.isArray((v as { objections?: unknown }).objections)
    ? ((v as { objections: unknown[] }).objections as unknown[]).map((x) => asRecord(x))
    : [];
  const faqArr = Array.isArray((v as { faq?: unknown }).faq)
    ? ((v as { faq: unknown[] }).faq as unknown[]).map((x) => asRecord(x))
    : [];
  const guarantee = asRecord((v as { guarantee?: unknown }).guarantee);

  const benefitItems =
    benefitsArr.length > 0
      ? benefitsArr
          .map((b) => ({
            title: typeof b.title === "string" ? b.title : "",
            desc:
              typeof b.description === "string"
                ? b.description
                : typeof b.desc === "string"
                  ? b.desc
                  : "",
          }))
          .filter((x) => x.title && x.desc)
      : [];

  const processItems =
    stepsArr.length > 0
      ? stepsArr
          .map((b) => ({
            title: typeof b.title === "string" ? b.title : "",
            desc:
              typeof b.description === "string"
                ? b.description
                : typeof b.desc === "string"
                  ? b.desc
                  : "",
          }))
          .filter((x) => x.title && x.desc)
      : [];

  const trustLine =
    typeof v.trustLine === "string"
      ? v.trustLine
      : typeof (v as { trust?: unknown }).trust === "string"
        ? String((v as { trust?: unknown }).trust)
        : "";

  const headline = typeof v.headline === "string" ? v.headline : "";
  const subheadline = typeof v.subheadline === "string" ? v.subheadline : "";
  const cta =
    typeof v.ctaText === "string"
      ? v.ctaText
      : typeof (v as { cta?: unknown }).cta === "string"
        ? String((v as { cta?: unknown }).cta)
        : typeof v.cta === "string"
          ? v.cta
          : "";

  const heroBadge =
    typeof (v as { heroBadge?: unknown }).heroBadge === "string"
      ? String((v as { heroBadge?: unknown }).heroBadge).trim().slice(0, 160)
      : typeof (v as { hero_badge?: unknown }).hero_badge === "string"
        ? String((v as { hero_badge?: unknown }).hero_badge).trim().slice(0, 160)
        : "";

  const blocks: unknown[] = [
    {
      type: "hero",
      headline,
      subheadline,
      cta_label: cta,
      trust_line: trustLine,
      ...(heroBadge ? { badge: heroBadge } : {}),
    },
  ];

  if (benefitItems.length) {
    blocks.push({ type: "benefits", items: benefitItems.map((x) => ({ title: x.title, desc: x.desc })) });
  }
  if (processItems.length) {
    blocks.push({ type: "process", items: processItems.map((x) => ({ title: x.title, desc: x.desc })) });
  }

  const offerBullets = Array.isArray((offer as { bullets?: unknown }).bullets)
    ? ((offer as { bullets: unknown[] }).bullets as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const offerTitle = typeof (offer as { title?: unknown }).title === "string" ? String((offer as { title?: unknown }).title) : "";
  const offerValueStack = Array.isArray((offer as { valueStack?: unknown }).valueStack)
    ? ((offer as { valueStack: unknown[] }).valueStack as unknown[]).map((x) => asRecord(x))
    : [];
  if (offerTitle || offerBullets.length || offerValueStack.length) {
    blocks.push({
      type: "offer",
      title: offerTitle || "What you get",
      bullets: offerBullets.length ? offerBullets : undefined,
      items: offerValueStack.length
        ? offerValueStack
            .map((x) => ({
              label: typeof x.label === "string" ? x.label : "",
              value: typeof x.value === "string" ? x.value : "",
            }))
            .filter((x) => x.label && x.value)
        : undefined,
    });
  }

  const proofPoints = Array.isArray((socialProof as { proofPoints?: unknown }).proofPoints)
    ? ((socialProof as { proofPoints: unknown[] }).proofPoints as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const testimonials = Array.isArray((socialProof as { testimonials?: unknown }).testimonials)
    ? ((socialProof as { testimonials: unknown[] }).testimonials as unknown[]).map((x) => asRecord(x))
    : [];
  const testimonialItems = testimonials
    .map((t) => ({
      name: typeof t.name === "string" ? t.name : "",
      role: typeof t.role === "string" ? t.role : "",
      quote: typeof t.quote === "string" ? t.quote : "",
    }))
    .filter((t) => t.quote);
  if (proofPoints.length || testimonialItems.length) {
    blocks.push({
      type: "social_proof",
      bullets: proofPoints.length ? proofPoints : undefined,
      items: testimonialItems.length ? testimonialItems : undefined,
    });
  }

  const objectionItems = objectionsArr
    .map((o) => ({
      question: typeof o.question === "string" ? o.question : "",
      answer: typeof o.answer === "string" ? o.answer : "",
    }))
    .filter((x) => x.question && x.answer);
  if (objectionItems.length) {
    blocks.push({ type: "objections", items: objectionItems });
  }

  const faqItems = faqArr
    .map((o) => ({
      question: typeof o.question === "string" ? o.question : "",
      answer: typeof o.answer === "string" ? o.answer : "",
    }))
    .filter((x) => x.question && x.answer);
  if (faqItems.length) {
    blocks.push({ type: "faq", items: faqItems });
  }

  const guaranteeHeadline =
    typeof (guarantee as { headline?: unknown }).headline === "string" ? String((guarantee as { headline?: unknown }).headline) : "";
  const guaranteeBody = typeof (guarantee as { body?: unknown }).body === "string" ? String((guarantee as { body?: unknown }).body) : "";
  if (guaranteeHeadline || guaranteeBody) {
    blocks.push({
      type: "guarantee",
      title: guaranteeHeadline || "Guarantee",
      body: guaranteeBody || undefined,
    });
  }

  blocks.push(...secBlocks);

  if (trustLine.trim()) {
    blocks.push({ type: "section", title: "Trust", body: trustLine });
  }

  blocks.push({ type: "lead_capture_form" });

  return blocks;
}

/** Persisted on variant `content` — public funnel picks layout + typography from this. */
export const DEFAULT_LANDING_VISUAL_PRESET = "editorial_light" as const;
export type LandingVisualPreset = "editorial_light" | "growth_dark";
