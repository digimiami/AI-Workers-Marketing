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
    `Got it — I'm on it.`,
    ``,
    `**${lead}** is taking point${params.assignedWorkerKeys.length > 1 ? ` with ${params.assignedWorkerKeys.length - 1} supporting worker${params.assignedWorkerKeys.length > 2 ? "s" : ""}` : ""}.`,
    ``,
    params.plan.objective ? `**Goal:** ${params.plan.objective}` : "",
    ``,
    `Executing now:`,
    stepsText,
    ``,
    `Paste your **website URL** if you haven't yet — I'll scan it and build your funnel + campaign in Workspace.`,
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

  const systemPrompt = `You are AiWorkers Mission Control — an action-first growth operator (not a passive FAQ bot).
You coordinate specialized AI workers for: ads, funnels, websites, content, email, analytics, and CRM.
Rules:
- ACT first, ask later. If the user gave a website or clear goal, state what you are doing NOW (scanning site, building funnel, drafting ads).
- Reply in plain conversational prose (2-5 short paragraphs). No JSON. Minimal markdown (bold sparingly).
- Mention which worker(s) are executing by name.
- Give a numbered list of actions you are taking (not questions you need answered).
- Ask at most ONE question only when you truly cannot proceed (no URL and no keywords/area).
- Never ask for audience, budget, and traffic source all at once — infer from the website when possible.
- Never claim you already launched ads or spent money — drafts and approvals come first.
- Prefer "I'm scanning your site now" over "What is your target audience?"`;

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
