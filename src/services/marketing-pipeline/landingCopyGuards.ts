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
  | "missing_variants";

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
  "tailored for local businesses",
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
];

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

export type LandingVariantQuality =
  | { ok: true }
  | { ok: false; reason: "missing_fields" | "too_short" | "banned_phrase" | "placeholder"; detail?: string };

/**
 * Variant-level quality gate used at the DB-save boundary in /api/growth/landing-variants
 * and other regen paths. Rejects empty/sentinel/AI-fallback content before it reaches the renderer.
 */
export function validateLandingVariantQuality(content: Record<string, unknown>): LandingVariantQuality {
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
  const haystack = [headline, subheadline, cta, benefitText, stepText].join(" ");

  const placeholder = findPlaceholderText(haystack);
  if (placeholder) return { ok: false, reason: "placeholder", detail: placeholder };
  const banned = LANDING_BANNED_SUBSTRINGS.find((p) => haystack.toLowerCase().includes(p.toLowerCase()));
  if (banned) return { ok: false, reason: "banned_phrase", detail: banned };

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
