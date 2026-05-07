import { env } from "@/lib/env";
import {
  assertAiUsageAllowed,
  getCachedAiJson,
  hashPrompt,
  recordAiUsage,
  setCachedAiJson,
} from "@/services/ai/rateLimiter";

export type JsonPromptMeta = {
  used: boolean;
  provider: "openai" | "fallback" | "cache";
  model?: string;
  baseUrl?: string;
  reason?: string;
  httpStatus?: number;
  cacheHit?: boolean;
  promptHash?: string;
};

export function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) return candidate;
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return null;
}

/**
 * Calls the internal OpenAI-compatible chat completions API and parses JSON output.
 * Falls back with `{ meta.used:false }` when keys are missing or HTTP fails.
 */
export async function runStrictJsonPrompt(params: {
  system: string;
  user: string;
  temperature?: number;
  fallbackJsonText: string;
  organizationId?: string | null;
  userId?: string | null;
  cacheTtlHours?: number;
}): Promise<{ jsonText: string; meta: JsonPromptMeta }> {
  const provider = env.server.INTERNAL_LLM_PROVIDER;
  const apiKey = env.server.INTERNAL_LLM_API_KEY;
  const model = env.server.INTERNAL_LLM_MODEL;
  const baseUrl = (env.server.INTERNAL_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const promptHash = hashPrompt({ system: params.system, user: params.user, model });

  const cached = await getCachedAiJson({ organizationId: params.organizationId ?? null, promptHash }).catch(() => null);
  if (cached) {
    await recordAiUsage({
      organizationId: params.organizationId ?? null,
      userId: params.userId ?? null,
      promptHash,
      provider: "cache",
      model,
      cacheHit: true,
    });
    return {
      jsonText: cached,
      meta: { used: true, provider: "cache", model: model ?? undefined, baseUrl, cacheHit: true, promptHash },
    };
  }

  if (provider !== "openai" || !apiKey || !model) {
    await recordAiUsage({
      organizationId: params.organizationId ?? null,
      userId: params.userId ?? null,
      promptHash,
      provider: "fallback",
      model,
      cacheHit: false,
      metadata: { reason: provider !== "openai" ? "provider_not_openai" : !apiKey ? "missing_key" : "missing_model" },
    });
    return {
      jsonText: params.fallbackJsonText,
      meta: {
        used: false,
        provider: "fallback",
        reason:
          provider !== "openai"
            ? "INTERNAL_LLM_PROVIDER is not 'openai'"
            : !apiKey
              ? "Missing INTERNAL_LLM_API_KEY"
              : "Missing INTERNAL_LLM_MODEL",
        model: model ?? undefined,
        baseUrl,
        promptHash,
      },
    };
  }

  await assertAiUsageAllowed({ organizationId: params.organizationId ?? null, userId: params.userId ?? null });

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: params.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
    });
  } catch (e) {
    await recordAiUsage({
      organizationId: params.organizationId ?? null,
      userId: params.userId ?? null,
      promptHash,
      provider: "fallback",
      model,
      cacheHit: false,
      metadata: { reason: "fetch_failed" },
    });
    return {
      jsonText: params.fallbackJsonText,
      meta: {
        used: false,
        provider: "fallback",
        model,
        baseUrl,
        reason: `Fetch failed: ${e instanceof Error ? e.message : String(e)}`,
        promptHash,
      },
    };
  }

  if (!response.ok) {
    await recordAiUsage({
      organizationId: params.organizationId ?? null,
      userId: params.userId ?? null,
      promptHash,
      provider: "fallback",
      model,
      cacheHit: false,
      metadata: { reason: "http_error", httpStatus: response.status },
    });
    return {
      jsonText: params.fallbackJsonText,
      meta: {
        used: false,
        provider: "fallback",
        model,
        baseUrl,
        httpStatus: response.status,
        reason: `OpenAI HTTP ${response.status}`,
        promptHash,
      },
    };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const extracted = extractJsonObject(content);
  if (!extracted) {
    await recordAiUsage({
      organizationId: params.organizationId ?? null,
      userId: params.userId ?? null,
      promptHash,
      provider: "fallback",
      model,
      cacheHit: false,
      metadata: { reason: "no_json" },
    });
    return {
      jsonText: params.fallbackJsonText,
      meta: { used: false, provider: "fallback", model, baseUrl, reason: "No JSON object in model response", promptHash },
    };
  }

  await setCachedAiJson({
    organizationId: params.organizationId ?? null,
    promptHash,
    provider: "openai",
    model,
    request: { temperature: params.temperature ?? 0.2 },
    jsonText: extracted,
    ttlHours: params.cacheTtlHours ?? 24,
  });
  await recordAiUsage({
    organizationId: params.organizationId ?? null,
    userId: params.userId ?? null,
    promptHash,
    provider: "openai",
    model,
    cacheHit: false,
  });

  return { jsonText: extracted, meta: { used: true, provider: "openai", model, baseUrl, promptHash } };
}
