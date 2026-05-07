/** Phrases that indicate template / filler copy (case-insensitive substring match). */
export const LANDING_BANNED_SUBSTRINGS = [
  "boost your business",
  "limited time offer",
  "ai solutions",
  "grow faster",
  "unlock your dream",
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
  return null;
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
