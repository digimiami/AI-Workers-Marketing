import { env } from "@/lib/env";
import { buildAiPlan } from "@/services/ai-agent/agentPlanner";
import { planSchema } from "@/services/ai-agent/types";
import type { AiPlan, RunAiMarketingAgentInput } from "@/services/ai-agent/types";

type PlannerInput = Omit<RunAiMarketingAgentInput, "organizationId" | "userId">;
export type InternalLlmPlanMeta = {
  used: boolean;
  provider: "openai" | "fallback";
  model?: string;
  baseUrl?: string;
  reason?: string;
  httpStatus?: number;
};

function extractJsonObject(text: string): string | null {
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

export async function planWithInternalLlmDebug(input: PlannerInput): Promise<{ plan: AiPlan; meta: InternalLlmPlanMeta }> {
  const provider = env.server.INTERNAL_LLM_PROVIDER;
  const apiKey = env.server.INTERNAL_LLM_API_KEY;
  const model = env.server.INTERNAL_LLM_MODEL;
  const baseUrl = (env.server.INTERNAL_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  if (provider !== "openai" || !apiKey || !model) {
    return {
      plan: buildAiPlan(input),
      meta: {
        used: false,
        provider: "fallback",
        reason: provider !== "openai" ? "INTERNAL_LLM_PROVIDER is not 'openai'" : !apiKey ? "Missing INTERNAL_LLM_API_KEY" : "Missing INTERNAL_LLM_MODEL",
        model: model ?? undefined,
        baseUrl,
      },
    };
  }

  const systemPrompt =
    "You are an AI marketing planner. Return ONLY valid JSON matching the required schema. No markdown.";
  const userPrompt = JSON.stringify(
    {
      task: "Build a safe, org-scoped marketing execution plan using internal tools and approval gates.",
      required_schema: {
        objective: "string",
        steps: [
          {
            name: "string",
            tools_needed: ["string"],
            records_to_create: ["string"],
            approval_required: "boolean",
            risk_level: "low|medium|high",
          },
        ],
        expected_outputs: ["string"],
      },
      constraints: [
        "Use tool-based execution only, never direct DB writes.",
        "High-risk actions must require approval.",
        "Prefer draft-safe actions first.",
      ],
      input,
    },
    null,
    2,
  );

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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (e) {
    return {
      plan: buildAiPlan(input),
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
      plan: buildAiPlan(input),
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
  const jsonText = extractJsonObject(content);
  if (!jsonText) {
    return {
      plan: buildAiPlan(input),
      meta: { used: false, provider: "fallback", model, baseUrl, reason: "No JSON object in OpenAI response" },
    };
  }

  try {
    return {
      plan: planSchema.parse(JSON.parse(jsonText)),
      meta: { used: true, provider: "openai", model, baseUrl },
    };
  } catch {
    return {
      plan: buildAiPlan(input),
      meta: { used: false, provider: "fallback", model, baseUrl, reason: "Plan JSON failed schema validation" },
    };
  }
}

export async function planWithInternalLlm(input: PlannerInput): Promise<AiPlan> {
  const { plan } = await planWithInternalLlmDebug(input);
  return plan;
}

