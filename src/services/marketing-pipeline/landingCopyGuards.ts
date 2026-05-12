import type { SupabaseClient } from "@supabase/supabase-js";

import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";

export type LandingFixReason =
  | "scrape_failed"
  | "model_unused"
  | "invalid_shape"
  | "banned_phrase"
  | "placeholder"
  | "not_anchored"
  | "body_not_anchored"
  | "missing_variants"
  | "generic_cta"
  | "low_conversion_score";

/**
 * Mark a campaign as `landing_status: needs_generation_fix` so the workspace UI can
 * surface a regenerate action instead of silently rendering placeholder pages.
 * Best-effort: never throws.
 */
export async function markCampaignNeedsLandingFix(params: {
  admin: SupabaseClient;
  organizationId: string;
  campaignId: string;
  reason: LandingFixReason;
  detail?: string | null;
}): Promise<void> {
  try {
    const { data: camp } = await params.admin
      .from("campaigns" as never)
      .select("metadata")
      .eq("organization_id", params.organizationId)
      .eq("id", params.campaignId)
      .maybeSingle();
    const prev = asMetadataRecord((camp as { metadata?: unknown } | null)?.metadata);
    const ge = asMetadataRecord(prev.growth_engine);
    const next = mergeJsonbRecords(prev, {
      growth_engine: {
        ...ge,
        landing_status: "needs_generation_fix",
        landing_fix: {
          reason: params.reason,
          detail: params.detail ?? null,
          marked_at: new Date().toISOString(),
        },
      },
    });
    await params.admin
      .from("campaigns" as never)
      .update({ metadata: next, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", params.organizationId)
      .eq("id", params.campaignId);
  } catch (error) {
    console.warn("[landing] failed to mark needs_generation_fix", {
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      reason: params.reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Clear the landing_status flag once a healthy variant is saved.
 */
export async function clearCampaignLandingFix(params: {
  admin: SupabaseClient;
  organizationId: string;
  campaignId: string;
}): Promise<void> {
  try {
    const { data: camp } = await params.admin
      .from("campaigns" as never)
      .select("metadata")
      .eq("organization_id", params.organizationId)
      .eq("id", params.campaignId)
      .maybeSingle();
    const prev = asMetadataRecord((camp as { metadata?: unknown } | null)?.metadata);
    const ge = asMetadataRecord(prev.growth_engine);
    if (ge.landing_status !== "needs_generation_fix" && !ge.landing_fix) return;
    const nextGe = { ...ge };
    delete (nextGe as Record<string, unknown>).landing_status;
    delete (nextGe as Record<string, unknown>).landing_fix;
    // Replace growth_engine wholesale (mergeJsonbRecords cannot delete keys).
    const next: Record<string, unknown> = { ...prev, growth_engine: nextGe };
    await params.admin
      .from("campaigns" as never)
      .update({ metadata: next, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", params.organizationId)
      .eq("id", params.campaignId);
  } catch {
    // best-effort
  }
}

/** Phrases that indicate template / filler copy (case-insensitive substring match). */
export const LANDING_BANNED_SUBSTRINGS = [
  "boost your business",
  "limited time offer",
  "ai solutions",
  "grow faster",
  "unlock your dream",
  "unlock your potential",
  "welcome to our service",
  "welcome to our community",
  "enhance your experience",
  "step into your future",
  "transform your local business with ai",
  "quickly transform your local business",
  "local business with ai",
  "your business with ai",
  "automated workflows tailored",
  "experience the convenience of automated",
  "countless local businesses",
  "join countless",
  "advanced technology at your fingertips",
  "convenient customer management",
  "launch your workflows instantly",
  "streamline their operations",
  "streamlined their operations",
  "see results almost immediately",
  "integrate our platform effortlessly",
  "connect with your tools in no time",
  "quickly transform your",
  "transform your local business",
  "experience the convenience",
  "leverage powerful tools",
  "without the hassle",
  "transform your marketing",
  "transform your marketing with",
  "transform your business",
  "boost your growth",
  "ai-driven workforce",
  "ai driven workforce",
  "rapid growth and efficiency",
  "schedule your free consultation",
  "free consultation now",
  "automated workflows",
  "optimized advertising",
  "optimized advertising spend",
  "data-driven insights",
  "data driven insights",
  "without the need for extensive resources",
  "discover opportunities",
  "architect your funnel",
  "produce and publish",
  "score angles and offers",
  "ship content on schedule",
];

/** Stopwords for keyword frequency extraction (URL/title anchoring). */
export const LANDING_FREQ_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "your",
  "you",
  "our",
  "are",
  "from",
  "that",
  "this",
  "to",
  "of",
  "in",
  "on",
  "a",
  "an",
  "as",
  "at",
  "by",
  "or",
  "it",
  "is",
  "be",
  "we",
  "they",
  "their",
  "not",
  "can",
  "will",
  "get",
  "fast",
  "track",
  "local",
  "lead",
  "generation",
  "ai",
]);

/**
 * True when the campaign URL is our own product/marketing site (allowed to say “AiWorkers”).
 */
export function isSelfBrandCampaignUrl(url: string): boolean {
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const host = new URL(normalized).hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "localhost" || host.startsWith("127.0.0.1")) return true;
    if (host.endsWith(".vercel.app")) return true;
    return /\.aiworkers\.(vip|com|io)$/i.test(host) || host === "aiworkers.vip" || host === "aiworkers.com";
  } catch {
    return false;
  }
}

/** Marketing copy that names our platform (reject on client-site campaigns). */
export function mentionsAiWorkersPlatform(text: string): boolean {
  return /\bai[\s-]*workers\b/i.test(text);
}

/**
 * Tokens that are unmistakable scaffolding placeholders left over from templating.
 * Matched as whole words / case-insensitive — `Benefit 1`, `Step 1`, `Outcome 1`, etc.
 */
const LANDING_PLACEHOLDER_PATTERNS: RegExp[] = [
  /\bbenefit\s*\d+\b/i,
  /\boutcome\s*\d+\b/i,
  /\bproof\s*point\s*\d+\b/i,
  /\bfast\s*win\s*\d+\b/i,
  /\blorem\s+ipsum\b/i,
  /\byour\s+headline\s+here\b/i,
];

export function findPlaceholderText(text: string): string | null {
  for (const re of LANDING_PLACEHOLDER_PATTERNS) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

const GENERIC_ANCHOR_TOKENS = new Set([
  "business",
  "businesses",
  "local",
  "quickly",
  "rapidly",
  "solution",
  "solutions",
  "platform",
  "workflow",
  "workflows",
  "technology",
  "results",
  "success",
  "customer",
  "customers",
  "implement",
  "implementation",
  "integration",
  "consultation",
  "tailored",
  "convenience",
  "convenient",
  "automated",
  "transform",
  "streamline",
  "streamlined",
  "marketing",
  "strategies",
  "strategy",
  "tools",
  "tool",
  "advanced",
  "measurable",
  "connected",
  "system",
  "operations",
  "fingertips",
  "hassle",
  "effortlessly",
  "instantly",
  "immediately",
  "google",
  "ads",
  "adwords",
  "affiliate",
  "lead",
  "leads",
  "generation",
  "traffic",
  "online",
  "digital",
]);

export function hostBrandFromUrl(url: string): string | null {
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const u = new URL(normalized);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const parts = host.split(".").filter(Boolean);
    if (!parts.length) return null;
    const skipSubdomains = new Set(["www", "app", "m", "shop", "store", "blog", "my", "dashboard", "api", "secure"]);
    let idx = 0;
    if (parts.length >= 2 && skipSubdomains.has(parts[0])) idx = 1;
    const main = parts[idx];
    if (main.length < 3) return null;
    return main;
  } catch {
    return null;
  }
}

export function findBannedSubstring(text: string): string | null {
  const lower = text.toLowerCase();
  for (const p of LANDING_BANNED_SUBSTRINGS) {
    if (lower.includes(p.toLowerCase())) return p;
  }
  return findPlaceholderText(lower);
}

/** Minimum heuristic conversion score (0–100) required before a variant may be published. */
export const LANDING_CONVERSION_SCORE_MIN = 85;

const WEAK_CTA_EXACT = new Set([
  "learn more",
  "get started",
  "submit",
  "continue",
  "click here",
  "read more",
  "sign up",
  "apply now",
  "subscribe",
  "download",
  "send",
  "next",
  "see more",
  "find out more",
  "discover more",
  "contact us",
  "request info",
  "get info",
  "try now",
  "more details",
  "enter",
  "go",
]);

/**
 * True when a primary button label is too generic or too thin for conversion pages.
 * Prefer first-person, outcome-specific labels (e.g. "Get my roof inspection", "Book my consult").
 */
export function isWeakLandingCtaLabel(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  if (WEAK_CTA_EXACT.has(t)) return true;
  if (t.length < 10) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && t.length < 22) return true;
  if (/^(click|tap|tap here|press here)\b/.test(t)) return true;
  return false;
}

function avgNonEmptyLengths(rows: unknown[], descKeys: string[]): number {
  let sum = 0;
  let n = 0;
  for (const row of rows) {
    const r = (row ?? {}) as Record<string, unknown>;
    let chunk = "";
    for (const k of descKeys) {
      const v = r[k];
      if (typeof v === "string" && v.trim()) chunk += v.trim();
    }
    if (chunk) {
      sum += chunk.length;
      n += 1;
    }
  }
  return n ? sum / n : 0;
}

function countRichSections(sectionsArr: unknown[]): number {
  let n = 0;
  for (const s of sectionsArr) {
    const r = (s ?? {}) as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    if (!title) continue;
    const body = typeof r.body === "string" ? r.body.trim() : "";
    const bullets = Array.isArray(r.bullets) ? (r.bullets as unknown[]).filter((b) => typeof b === "string" && String(b).trim().length >= 8) : [];
    if (body.length >= 50 || bullets.length >= 2) n += 1;
  }
  return n;
}

/**
 * Heuristic 0–100 conversion strength score (clarity, depth, proof, CTA, closing).
 * Used to enforce an internal quality bar before publishing variants.
 */
export function computeLandingConversionScore(content: Record<string, unknown>): number {
  const headline = String(content?.headline ?? "").trim();
  const subheadline = String(content?.subheadline ?? "").trim();
  const cta = String(
    (content as { ctaText?: unknown }).ctaText ?? (content as { cta?: unknown }).cta ?? "",
  ).trim();
  const trustLine = String((content as { trustLine?: unknown }).trustLine ?? "").trim();
  const benefits = Array.isArray(content?.benefits) ? (content.benefits as unknown[]) : [];
  const steps = Array.isArray(content?.steps) ? (content.steps as unknown[]) : [];
  const sectionsArr = Array.isArray((content as { sections?: unknown }).sections)
    ? ((content as { sections: unknown[] }).sections as unknown[])
    : [];
  const objections = Array.isArray((content as { objections?: unknown }).objections)
    ? ((content as { objections: unknown[] }).objections as unknown[])
    : [];
  const faq = Array.isArray((content as { faq?: unknown }).faq) ? ((content as { faq: unknown[] }).faq as unknown[]) : [];
  const guarantee = (content as { guarantee?: unknown }).guarantee;
  const g = guarantee && typeof guarantee === "object" && !Array.isArray(guarantee) ? (guarantee as Record<string, unknown>) : {};
  const gHead = typeof g.headline === "string" ? g.headline.trim() : "";
  const gBody = typeof g.body === "string" ? g.body.trim() : "";
  const social = (content as { socialProof?: unknown }).socialProof;
  const sp = social && typeof social === "object" && !Array.isArray(social) ? (social as Record<string, unknown>) : {};
  const testimonials = Array.isArray(sp.testimonials) ? (sp.testimonials as unknown[]) : [];
  const proofPoints = Array.isArray(sp.proofPoints) ? (sp.proofPoints as unknown[]).filter((p) => typeof p === "string") : [];
  let bestQuote = 0;
  for (const t of testimonials) {
    const r = (t ?? {}) as Record<string, unknown>;
    const q = typeof r.quote === "string" ? r.quote.trim().length : 0;
    if (q > bestQuote) bestQuote = q;
  }
  const proofLens = proofPoints.map((p) => String(p).trim().length).filter((n) => n >= 10);
  const finalCtaRaw = (content as { finalCTA?: unknown }).finalCTA;
  const finalCta =
    finalCtaRaw && typeof finalCtaRaw === "object" && !Array.isArray(finalCtaRaw)
      ? (finalCtaRaw as Record<string, unknown>)
      : {};
  const finalHead = typeof finalCta.headline === "string" ? finalCta.headline.trim() : "";
  const finalSub = typeof finalCta.subheadline === "string" ? finalCta.subheadline.trim() : "";
  const finalCtaText = typeof finalCta.ctaText === "string" ? finalCta.ctaText.trim() : "";
  const psych = String((content as { psychologicalTrigger?: unknown }).psychologicalTrigger ?? "").trim();

  let raw = 0;
  raw += headline.length >= 34 ? 8 : headline.length >= 20 ? 6 : headline.length >= 12 ? 3 : 0;
  raw += subheadline.length >= 52 ? 10 : subheadline.length >= 32 ? 7 : subheadline.length >= 16 ? 4 : 0;
  if (!isWeakLandingCtaLabel(cta)) {
    const wc = cta.split(/\s+/).filter(Boolean).length;
    raw += wc >= 5 && cta.length >= 22 ? 15 : wc >= 4 && cta.length >= 16 ? 12 : cta.length >= 12 ? 9 : 5;
  }
  const avgBen = avgNonEmptyLengths(benefits, ["description", "desc"]);
  raw += benefits.length >= 4 && avgBen >= 40 ? 15 : benefits.length >= 4 && avgBen >= 26 ? 11 : benefits.length >= 3 && avgBen >= 20 ? 7 : 0;
  const avgStep = avgNonEmptyLengths(steps, ["description", "desc"]);
  raw += steps.length >= 3 && avgStep >= 30 ? 12 : steps.length >= 3 && avgStep >= 20 ? 9 : steps.length >= 2 && avgStep >= 16 ? 5 : 0;
  raw += trustLine.length >= 26 ? 8 : trustLine.length >= 18 ? 5 : trustLine.length >= 12 ? 3 : 0;
  const richSec = countRichSections(sectionsArr);
  raw += richSec >= 3 ? 10 : richSec >= 2 ? 7 : richSec >= 1 ? 4 : 0;
  if (bestQuote >= 45 || proofLens.length >= 3) raw += 9;
  else if (bestQuote >= 26 || proofLens.length >= 2) raw += 6;
  else if (bestQuote > 0 || proofLens.length >= 1) raw += 3;
  raw += objections.length >= 2 ? 2 : objections.length >= 1 ? 1 : 0;
  raw += faq.length >= 2 ? 2 : faq.length >= 1 ? 1 : 0;
  raw += gHead.length >= 10 && gBody.length >= 38 ? 4 : gBody.length >= 24 ? 2 : 0;
  if (finalHead.length >= 14 && finalSub.length >= 14 && finalCtaText.length >= 10 && !isWeakLandingCtaLabel(finalCtaText)) {
    raw += 6;
  } else if (finalHead.length >= 10 && finalSub.length >= 10 && finalCtaText.length >= 8) {
    raw += 3;
  }
  raw += psych.length >= 26 ? 4 : psych.length >= 14 ? 2 : 0;

  const RAW_MAX = 95;
  return Math.min(100, Math.round((Math.min(raw, RAW_MAX) / RAW_MAX) * 100));
}

export type LandingVariantQuality =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "missing_fields"
        | "too_short"
        | "banned_phrase"
        | "placeholder"
        | "not_anchored"
        | "generic_cta"
        | "low_conversion_score";
      detail?: string;
    };

export type LandingVariantQualityCtx = {
  campaignUrl: string;
  scrapedTitle?: string | null;
  scrapedContentPrefix?: string;
};

/**
 * Variant-level quality gate used at the DB-save boundary in /api/growth/landing-variants
 * and other regen paths. Rejects empty/sentinel/AI-fallback content before it reaches the renderer.
 */
export function validateLandingVariantQuality(
  content: Record<string, unknown>,
  ctx?: LandingVariantQualityCtx,
): LandingVariantQuality {
  const headline = String(content?.headline ?? "").trim();
  const subheadline = String(content?.subheadline ?? "").trim();
  const cta =
    String(
      (content as { ctaText?: unknown }).ctaText ??
        (content as { cta?: unknown }).cta ??
        "",
    ).trim();
  const benefits = Array.isArray(content?.benefits) ? (content.benefits as unknown[]) : [];
  const steps = Array.isArray(content?.steps) ? (content.steps as unknown[]) : [];

  if (!headline || !subheadline || !cta) {
    return { ok: false, reason: "missing_fields", detail: "headline+subheadline+cta required" };
  }
  if (headline.length < 12 || subheadline.length < 16) {
    return { ok: false, reason: "too_short", detail: `headline=${headline.length} sub=${subheadline.length}` };
  }
  if (benefits.length < 3 || steps.length < 2) {
    return { ok: false, reason: "missing_fields", detail: `benefits=${benefits.length} steps=${steps.length}` };
  }

  const viRaw = (content as { visualIdentity?: unknown }).visualIdentity;
  const vi = viRaw && typeof viRaw === "object" && !Array.isArray(viRaw) ? (viRaw as Record<string, unknown>) : null;
  if (!vi) {
    return { ok: false, reason: "missing_fields", detail: "visualIdentity required (paletteHint, typographyHint, mood)" };
  }
  for (const k of ["paletteHint", "typographyHint", "mood"] as const) {
    const s = typeof vi[k] === "string" ? vi[k].trim() : "";
    if (s.length < 6) {
      return { ok: false, reason: "missing_fields", detail: `visualIdentity.${k} too short or missing` };
    }
  }

  const benefitText = benefits
    .map((b) => {
      const r = (b ?? {}) as Record<string, unknown>;
      return `${String(r.title ?? "")} ${String(r.description ?? r.desc ?? "")}`;
    })
    .join(" ");
  const stepText = steps
    .map((s) => {
      const r = (s ?? {}) as Record<string, unknown>;
      return `${String(r.title ?? "")} ${String(r.description ?? r.desc ?? "")}`;
    })
    .join(" ");
  const trustLine = typeof (content as { trustLine?: unknown }).trustLine === "string" ? String((content as { trustLine?: unknown }).trustLine) : "";
  const finalCtaRaw = (content as { finalCTA?: unknown }).finalCTA;
  const finalCta =
    finalCtaRaw && typeof finalCtaRaw === "object" && !Array.isArray(finalCtaRaw)
      ? (finalCtaRaw as Record<string, unknown>)
      : {};
  const finalHead = typeof finalCta.headline === "string" ? finalCta.headline : "";
  const finalSub = typeof finalCta.subheadline === "string" ? finalCta.subheadline : "";
  const finalCtaText = typeof finalCta.ctaText === "string" ? String(finalCta.ctaText) : "";
  const heroBadge =
    typeof (content as { heroBadge?: unknown }).heroBadge === "string" ? String((content as { heroBadge?: unknown }).heroBadge) : "";
  const sectionsArr = Array.isArray((content as { sections?: unknown }).sections)
    ? ((content as { sections: unknown[] }).sections as unknown[])
    : [];
  const sectionsText = sectionsArr.map((s) => (typeof s === "object" && s ? JSON.stringify(s) : "")).join(" ");
  const visualHay = `${String(vi.paletteHint ?? "")} ${String(vi.typographyHint ?? "")} ${String(vi.mood ?? "")}`;

  const haystack = [headline, subheadline, cta, benefitText, stepText, trustLine, finalHead, finalSub, finalCtaText, heroBadge, sectionsText, visualHay].join(" ");

  const placeholder = findPlaceholderText(haystack);
  if (placeholder) return { ok: false, reason: "placeholder", detail: placeholder };
  const banned = LANDING_BANNED_SUBSTRINGS.find((p) => haystack.toLowerCase().includes(p.toLowerCase()));
  if (banned) return { ok: false, reason: "banned_phrase", detail: banned };

  if (ctx?.campaignUrl) {
    if (!isSelfBrandCampaignUrl(ctx.campaignUrl) && mentionsAiWorkersPlatform(haystack)) {
      return {
        ok: false,
        reason: "banned_phrase",
        detail: "AiWorkers platform copy is not allowed when the campaign URL is a client site",
      };
    }
    const hostBrand = hostBrandFromUrl(ctx.campaignUrl);
    const title = ctx.scrapedTitle ?? "";
    const prefix = ctx.scrapedContentPrefix ?? "";
    const strong = strongTitleAnchors(title, LANDING_FREQ_STOPWORDS);
    if (!isSelfBrandCampaignUrl(ctx.campaignUrl) && (hostBrand || strong.length)) {
      if (!isHeroAnchored({ headline, subheadline, hostBrand, strongTitleTokens: strong })) {
        return {
          ok: false,
          reason: "not_anchored",
          detail: `Headline/subheadline must reference the client site or page (e.g. "${hostBrand ?? strong[0] ?? "brand"}")`,
        };
      }
      const bodyBits = [cta, benefitText, stepText, sectionsText].join(" ").toLowerCase();
      const bodyKeys = specificPageKeywords(title, prefix.slice(0, 4000), LANDING_FREQ_STOPWORDS, 16);
      if (bodyKeys.length && !bodyKeys.some((k) => bodyBits.includes(k.toLowerCase()))) {
        return {
          ok: false,
          reason: "not_anchored",
          detail: "Benefits/steps must include at least one concrete term from the scraped page",
        };
      }
    }
  }

  if (isWeakLandingCtaLabel(cta)) {
    return { ok: false, reason: "generic_cta", detail: `Hero CTA is too generic or thin: "${cta.slice(0, 80)}"` };
  }
  if (finalCtaText.trim() && isWeakLandingCtaLabel(finalCtaText)) {
    return { ok: false, reason: "generic_cta", detail: `Closing CTA is too generic or thin: "${finalCtaText.slice(0, 80)}"` };
  }

  const conversionScore = computeLandingConversionScore(content);
  if (conversionScore < LANDING_CONVERSION_SCORE_MIN) {
    return {
      ok: false,
      reason: "low_conversion_score",
      detail: `conversion_score=${conversionScore} (min ${LANDING_CONVERSION_SCORE_MIN})`,
    };
  }

  return { ok: true };
}

export function extractFreqKeywords(text: string, stop: Set<string>, limit: number): string[] {
  const tokens = String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !stop.has(t));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, limit);
}

/** Tokens from page title that are specific enough to require in hero copy. */
export function strongTitleAnchors(title: string | null | undefined, stop: Set<string>): string[] {
  const raw = extractFreqKeywords(title ?? "", stop, 24);
  return raw.filter((t) => !GENERIC_ANCHOR_TOKENS.has(t) && t.length >= 4);
}

export function specificPageKeywords(title: string, contentPrefix: string, stop: Set<string>, limit = 16): string[] {
  const merged = `${title}\n${contentPrefix}`;
  const scored = extractFreqKeywords(merged, stop, 40);
  return scored.filter((t) => !GENERIC_ANCHOR_TOKENS.has(t)).slice(0, limit);
}

/**
 * Hero copy must mention the URL brand or at least one strong title token
 * (so "local business + AI" templates fail when the real site is Dulce Diaz, etc.).
 */
export function isHeroAnchored(params: {
  headline: string;
  subheadline: string;
  hostBrand: string | null;
  strongTitleTokens: string[];
}): boolean {
  if (!params.hostBrand && params.strongTitleTokens.length === 0) {
    return true;
  }
  const hero = `${params.headline} ${params.subheadline}`.toLowerCase();
  if (params.hostBrand && params.hostBrand.length >= 3 && hero.includes(params.hostBrand)) {
    return true;
  }
  for (const t of params.strongTitleTokens) {
    if (t.length >= 5 && hero.includes(t.toLowerCase())) return true;
  }
  for (const t of params.strongTitleTokens) {
    if (hero.includes(t.toLowerCase())) return true;
  }
  return false;
}
