import { env } from "@/lib/env";
import { buildAiPlan } from "@/services/ai-agent/agentPlanner";
import { planSchema } from "@/services/ai-agent/types";
import type { AiPlan, RunAiMarketingAgentInput } from "@/services/ai-agent/types";

type PlannerInput = Omit<RunAiMarketingAgentInput, "organizationId" | "userId">;

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

export async function planWithInternalLlm(input: PlannerInput): Promise<AiPlan> {
  const provider = env.server.INTERNAL_LLM_PROVIDER;
  const apiKey = env.server.INTERNAL_LLM_API_KEY;
  const model = env.server.INTERNAL_LLM_MODEL;
  const baseUrl = (env.server.INTERNAL_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  if (provider !== "openai" || !apiKey || !model) {
    return buildAiPlan(input);
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

  const response = await fetch(`${baseUrl}/chat/completions`, {
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

  if (!response.ok) {
    return buildAiPlan(input);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const jsonText = extractJsonObject(content);
  if (!jsonText) return buildAiPlan(input);

  try {
    return planSchema.parse(JSON.parse(jsonText));
  } catch {
    return buildAiPlan(input);
  }
}

