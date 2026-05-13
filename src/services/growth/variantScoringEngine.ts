import { findBannedSubstring } from "@/services/marketing-pipeline/landingCopyGuards";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Pull hero + body text from variant `content` (blocks + flat fields). */
export function flattenVariantCopy(content: Record<string, unknown>): {
  headline: string;
  subheadline: string;
  cta: string;
  body: string;
  benefitCount: number;
  stepCount: number;
} {
  const blocks = Array.isArray(content.blocks) ? (content.blocks as unknown[]) : [];
  let headline = str(content.headline);
  let subheadline = str(content.subheadline);
  let cta = str(content.ctaText) || str(content.cta);
  let benefitCount = Array.isArray(content.benefits) ? (content.benefits as unknown[]).length : 0;
  let stepCount = Array.isArray(content.steps) ? (content.steps as unknown[]).length : 0;
  const parts: string[] = [];

  for (const b of blocks) {
    const o = asRecord(b);
    const t = str(o.type);
    if (t === "hero") {
      headline = headline || str(o.headline);
      subheadline = subheadline || str(o.subheadline);
      cta = cta || str(o.cta_label) || str(o.ctaText);
    }
    if (t === "benefits") {
      const items = Array.isArray(o.items) ? (o.items as unknown[]) : [];
      benefitCount = Math.max(benefitCount, items.length);
      for (const it of items) parts.push(str(asRecord(it).title), str(asRecord(it).desc));
    }
    if (t === "process" || t === "steps") {
      const items = Array.isArray(o.items) ? (o.items as unknown[]) : [];
      stepCount = Math.max(stepCount, items.length);
    }
    parts.push(str(o.body), str(o.title));
  }

  return {
    headline,
    subheadline,
    cta,
    body: [headline, subheadline, cta, ...parts].join(" \n "),
    benefitCount,
    stepCount,
  };
}

export type VariantDimensionScores = {
  clarity: number;
  trust: number;
  emotionalImpact: number;
  ctaStrength: number;
  mobileFriendly: number;
  conversionPotential: number;
};

export type ScoredVariant = {
  variantId: string;
  variantKey: string;
  composite: number;
  dimensions: VariantDimensionScores;
  notes: string[];
};

const ACTION_VERBS = /^(get|book|schedule|start|claim|request|see|show|find|unlock|download|reserve|apply)\b/i;
const TRUST_MARKERS = /\b(proven|guarantee|certified|insured|licensed|trusted|reviews|rating|years|warranty)\b/i;
const EMOTION_MARKERS = /\b(stop|avoid|finally|without|faster|dream|worry|stress|confident|relief)\b/i;

/**
 * Heuristic pre-launch scores (0–100 per dimension) aligned with the Growth Engine diagram.
 * Does not replace human review; pairs with live analytics after traffic exists.
 */
export function scoreLandingVariantContent(params: {
  variantId: string;
  variantKey: string;
  content: Record<string, unknown>;
}): ScoredVariant {
  const { headline, subheadline, cta, body, benefitCount, stepCount } = flattenVariantCopy(params.content);
  const full = `${headline} ${subheadline} ${cta} ${body}`.toLowerCase();
  const notes: string[] = [];

  const banned = findBannedSubstring(full);
  if (banned) notes.push(`Banned / generic phrase detected: ${banned}`);

  const hlLen = headline.trim().length;
  const clarity =
    hlLen >= 28 && hlLen <= 110 && subheadline.trim().length >= 24
      ? 88
      : hlLen >= 18
        ? 68
        : 42;

  const trust = TRUST_MARKERS.test(full) || full.includes("money-back") ? 82 : subheadline.length > 40 ? 70 : 55;

  const emotionalImpact = EMOTION_MARKERS.test(full) ? 78 : 58;

  const ctaStrength = ACTION_VERBS.test(cta.trim()) && cta.trim().length >= 8 && cta.trim().length <= 48 ? 90 : cta.trim().length >= 4 ? 62 : 35;

  const mobileFriendly =
    hlLen <= 72 && subheadline.length <= 220 && cta.length <= 44 ? 85 : hlLen <= 100 ? 70 : 52;

  const conversionPotential =
    benefitCount >= 3 && stepCount >= 2 && ctaStrength >= 70 ? 88 : benefitCount >= 2 && stepCount >= 1 ? 68 : 45;

  const dims: VariantDimensionScores = {
    clarity: clamp(clarity - (banned ? 25 : 0), 0, 100),
    trust: clamp(trust - (banned ? 15 : 0), 0, 100),
    emotionalImpact: clamp(emotionalImpact - (banned ? 20 : 0), 0, 100),
    ctaStrength: clamp(ctaStrength - (banned ? 30 : 0), 0, 100),
    mobileFriendly: clamp(mobileFriendly, 0, 100),
    conversionPotential: clamp(conversionPotential - (banned ? 35 : 0), 0, 100),
  };

  const composite = Math.round(
    (dims.clarity +
      dims.trust +
      dims.emotionalImpact +
      dims.ctaStrength +
      dims.mobileFriendly +
      dims.conversionPotential) /
      6,
  );

  if (headline.trim().length < 12) notes.push("Headline too short for a strong clarity score.");
  if (!ACTION_VERBS.test(cta.trim())) notes.push("CTA should start with a strong action verb.");

  return {
    variantId: params.variantId,
    variantKey: params.variantKey,
    composite,
    dimensions: dims,
    notes,
  };
}

export function pickSuggestedWinner(scored: ScoredVariant[]): { variantKey: string; variantId: string; composite: number } | null {
  if (!scored.length) return null;
  const sorted = [...scored].sort((a, b) => b.composite - a.composite);
  const top = sorted[0]!;
  return { variantKey: top.variantKey, variantId: top.variantId, composite: top.composite };
}
