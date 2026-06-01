import { env } from "@/lib/env";
import { MISSION_WORKERS } from "@/domain/mission-control/workerRegistry";
import type { MissionWorkerKey } from "@/domain/mission-control/types";
import type { RoutedMissionCommand } from "@/domain/mission-control/types";
import type { AiPlan } from "@/services/ai-agent/types";
import { assertAiUsageAllowed, recordAiUsage } from "@/services/ai/rateLimiter";

export type ChatTurn = { role: "user" | "assistant"; content: string };

function workerDisplayName(key: string) {
  return MISSION_WORKERS[key as MissionWorkerKey]?.name ?? key.replace(/_/g, " ");
}

function buildFallbackReply(params: {
  userMessage: string;
  routed: RoutedMissionCommand;
  plan: AiPlan;
  assignedWorkerKeys: string[];
}): string {
  const lead = workerDisplayName(params.routed.primaryWorker);
  const steps = params.routed.suggestedPlaybookSteps.slice(0, 4);
  const stepsText =
    steps.length > 0
      ? steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "1. Clarify your goal\n2. Assign the right workers\n3. Execute with your approval";

  return [
    `Absolutely — I can help with that.`,
    ``,
    `I'll loop in our **${lead}**${params.assignedWorkerKeys.length > 1 ? ` (plus ${params.assignedWorkerKeys.length - 1} supporting worker${params.assignedWorkerKeys.length > 2 ? "s" : ""})` : ""}.`,
    ``,
    params.plan.objective ? `**Goal:** ${params.plan.objective}` : "",
    ``,
    `Here's the plan I'd run:`,
    stepsText,
    ``,
    `Say **"go ahead"** when you want me to start in Workspace, or tell me what to change (budget, audience, offer, etc.).`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateMissionControlReply(params: {
  userMessage: string;
  history: ChatTurn[];
  routed: RoutedMissionCommand;
  plan: AiPlan;
  assignedWorkerKeys: string[];
  organizationId: string;
  userId: string;
}): Promise<{ reply: string; suggestions: string[] }> {
  const suggestions = buildQuickReplies(params.routed.intent);
  const fallback = buildFallbackReply(params);

  const provider = env.server.INTERNAL_LLM_PROVIDER;
  const apiKey = env.server.INTERNAL_LLM_API_KEY;
  const model = env.server.INTERNAL_LLM_MODEL;
  const baseUrl = (env.server.INTERNAL_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  if (provider !== "openai" || !apiKey || !model) {
    return { reply: fallback, suggestions };
  }

  try {
    await assertAiUsageAllowed({ organizationId: params.organizationId, userId: params.userId });
  } catch {
    return { reply: fallback, suggestions };
  }

  const workerContext = params.assignedWorkerKeys
    .map((k) => `- ${workerDisplayName(k)}: ${MISSION_WORKERS[k as MissionWorkerKey]?.description ?? ""}`)
    .join("\n");

  const systemPrompt = `You are AiWorkers Mission Control — a warm, expert business assistant (like a great HubSpot + marketing strategist chatbot).
You coordinate specialized AI workers for: ads, funnels, websites, content, email, analytics, and CRM.
Rules:
- Reply in plain conversational prose (2-6 short paragraphs max). No JSON. Minimal markdown (bold sparingly).
- Be friendly, confident, and specific to the user's request.
- Mention which worker(s) will handle the task by name.
- Give a numbered mini-plan (3-5 steps) when they're asking you to do something.
- End with ONE clear question or call-to-action (e.g. approve, share URL, confirm budget).
- Never claim you already launched ads or spent money — drafts and approvals come first.
- If the request is vague, ask one clarifying question.`;

  const contextBlock = `Intent: ${params.routed.intent}
Primary worker: ${workerDisplayName(params.routed.primaryWorker)}
Supporting workers: ${params.assignedWorkerKeys.map(workerDisplayName).join(", ")}
Plan objective: ${params.plan.objective}
Suggested steps: ${params.routed.suggestedPlaybookSteps.join(" → ")}

Workers:
${workerContext}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...params.history.slice(-12).map((t) => ({ role: t.role, content: t.content })),
    {
      role: "user",
      content: `${contextBlock}\n\nUser message: ${params.userMessage}`,
    },
  ];

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
        temperature: 0.65,
        max_tokens: 600,
        messages,
      }),
    });
  } catch {
    return { reply: fallback, suggestions };
  }

  if (!response.ok) {
    return { reply: fallback, suggestions };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) return { reply: fallback, suggestions };

  await recordAiUsage({
    organizationId: params.organizationId,
    userId: params.userId,
    provider: "openai",
    model,
    cacheHit: false,
    metadata: { surface: "mission_control_chat" },
  }).catch(() => undefined);

  return { reply: content, suggestions };
}

function buildQuickReplies(intent: string): string[] {
  switch (intent) {
    case "create_ads":
      return ["Use $500 on Meta", "Draft Google search ads", "Show me audiences"];
    case "build_funnel":
    case "build_landing_page":
      return ["Go ahead and build it", "Make it for local leads", "Add a thank-you page"];
    case "lead_generation_playbook":
      return ["Go ahead — start the playbook", "Focus on roofing", "I need 50 leads first"];
    case "analyze_performance":
      return ["Show ROAS by campaign", "What should I optimize?", "Run optimization loop"];
    default:
      return ["Go ahead", "Tell me more", "Open Workspace"];
  }
}
