import { buildLandingVariantsUserPrompt, LANDING_VARIANTS_SYSTEM } from "@/ai/prompts/landing_variants.prompt";
import { runStrictJsonPrompt, type JsonPromptMeta } from "@/services/ai/jsonPrompt";

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Sentinel shape used as `fallback` when the AI provider is unavailable.
 * Intentionally contains NO marketing copy. Callers must validate via
 * `validateLandingVariantQuality` and treat empty content as `needs_generation_fix`.
 */
function emptyVariantsFallback() {
  return JSON.stringify({ variants: [] });
}

export type LandingVariantsResult = {
  variants: Record<string, unknown>;
  meta: JsonPromptMeta;
};

export async function generateLandingVariants(input: {
  url: string;
  content?: string;
  goal: string;
  audience: string;
  trafficSource: string;
  baseLanding: Record<string, unknown> | null;
}): Promise<LandingVariantsResult> {
  const userPrompt = buildLandingVariantsUserPrompt({
    url: input.url,
    content: String(input.content ?? ""),
    goal: input.goal,
    audience: input.audience,
    trafficSource: input.trafficSource,
    baseLanding: input.baseLanding,
  });

  console.info("[landing] variants-prompt", {
    url: input.url,
    contentChars: String(input.content ?? "").length,
    goal: input.goal,
    audience: input.audience,
    trafficSource: input.trafficSource,
    hasBase: Boolean(input.baseLanding),
  });

  const out = await runStrictJsonPrompt({
    system: LANDING_VARIANTS_SYSTEM,
    user: userPrompt,
    fallbackJsonText: emptyVariantsFallback(),
  });

  const parsed = safeParseRecord(out.jsonText);
  const variantsArr = Array.isArray((parsed as { variants?: unknown }).variants)
    ? ((parsed as { variants: unknown[] }).variants as unknown[])
    : [];

  console.info("[landing] variants-response", {
    used: out.meta.used,
    cacheHit: out.meta.cacheHit,
    rawChars: out.jsonText.length,
    variantsCount: variantsArr.length,
    keys: variantsArr
      .map((v) => (v && typeof v === "object" ? String((v as Record<string, unknown>).variantKey ?? "") : ""))
      .filter(Boolean),
  });

  return { variants: parsed, meta: out.meta };
}
