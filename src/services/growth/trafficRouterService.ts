import { buildTrafficRouterUserPrompt, TRAFFIC_ROUTER_SYSTEM } from "@/ai/prompts/traffic_router.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function variantLetterToDbKey(letter: string): "direct_response" | "premium_trust" | "speed_convenience" {
  const L = letter.trim().toUpperCase();
  if (L === "B") return "premium_trust";
  if (L === "C") return "speed_convenience";
  return "direct_response";
}

export async function routeTrafficToVariant(input: {
  trafficSource: string;
  device: string;
  intentLevel: "low" | "medium" | "high" | "unknown";
  location?: string | null;
  userBehavior?: Record<string, unknown> | null;
  variantPerformance?: Record<string, unknown> | null;
}): Promise<Record<string, unknown>> {
  const fallbackJsonText = JSON.stringify({
    selectedVariant: "A",
    reason: "Default routing until performance data is available.",
    confidenceScore: 0.33,
    fallbackVariant: "B",
    routingRule: "even_split_default",
  });

  const out = await runStrictJsonPrompt({
    system: TRAFFIC_ROUTER_SYSTEM,
    user: buildTrafficRouterUserPrompt({
      trafficSource: input.trafficSource,
      device: input.device,
      intentLevel: input.intentLevel,
      location: input.location ?? null,
      userBehavior: input.userBehavior ?? null,
      variantPerformance: input.variantPerformance ?? null,
    }),
    fallbackJsonText,
  });
  return safeParseRecord(out.jsonText);
}
