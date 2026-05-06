import { env } from "@/lib/env";

export type JsonPromptMeta = {
  used: boolean;
  provider: "openai" | "fallback";
  model?: string;
  baseUrl?: string;
  reason?: string;
  httpStatus?: number;
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
}): Promise<{ jsonText: string; meta: JsonPromptMeta }> {
  const provider = env.server.INTERNAL_LLM_PROVIDER;
  const apiKey = env.server.INTERNAL_LLM_API_KEY;
  const model = env.server.INTERNAL_LLM_MODEL;
  const baseUrl = (env.server.INTERNAL_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  if (provider !== "openai" || !apiKey || !model) {
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
      },
    };
  }

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
    return {
      jsonText: params.fallbackJsonText,
      meta: {
        used: false,
        provider: "fallback",
        model,
        baseUrl,
        reason: `Fetch failed: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }

  if (!response.ok) {
    return {
      jsonText: params.fallbackJsonText,
      meta: {
        used: false,
        provider: "fallback",
        model,
        baseUrl,
        httpStatus: response.status,
        reason: `OpenAI HTTP ${response.status}`,
      },
    };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const extracted = extractJsonObject(content);
  if (!extracted) {
    return {
      jsonText: params.fallbackJsonText,
      meta: { used: false, provider: "fallback", model, baseUrl, reason: "No JSON object in model response" },
    };
  }

  return { jsonText: extracted, meta: { used: true, provider: "openai", model, baseUrl } };
}
