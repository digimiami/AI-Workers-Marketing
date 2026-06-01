import type { SupabaseClient } from "@supabase/supabase-js";

import { routeMissionCommand } from "@/domain/mission-control/intentRouter";
import { resolveLegacyAgentKey } from "@/domain/mission-control/workerRegistry";
import type { MissionWorkerKey } from "@/domain/mission-control/types";
import { buildAiMarketingPlan } from "@/services/ai-agent/agentOrchestrator";
import type { RunAiMarketingAgentInput } from "@/services/ai-agent/types";
import { generateMissionControlReply } from "@/services/mission-control/chatAssistant";
import { upsertBusinessMemory } from "@/services/mission-control/memoryService";
import { historyFromRows, listSessionMessages } from "@/services/mission-control/sessionService";
import { syncAgentsAndTemplates } from "@/services/openclaw/orchestrationService";

export async function processMissionCommand(params: {
  db: SupabaseClient;
  organizationId: string;
  userId: string;
  message: string;
  sessionId?: string;
  campaignId?: string;
}) {
  const routed = routeMissionCommand(params.message);

  let sessionId = params.sessionId ?? null;
  let priorHistory: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (sessionId) {
    try {
      const prior = await listSessionMessages(params.db, params.organizationId, sessionId, 40);
      priorHistory = historyFromRows(prior);
    } catch {
      priorHistory = [];
    }
  }

  if (!sessionId) {
    const { data: session, error } = await params.db
      .from("mission_control_sessions" as never)
      .insert({
        organization_id: params.organizationId,
        user_id: params.userId,
        campaign_id: params.campaignId ?? null,
        title: params.message.slice(0, 80),
        metadata: { source: "command_center" },
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    sessionId = (session as { id: string }).id;
  }

  await params.db.from("mission_control_messages" as never).insert({
    organization_id: params.organizationId,
    session_id: sessionId,
    role: "user",
    content: params.message,
    intent: routed.intent,
    metadata: { campaign_id: params.campaignId ?? null },
  } as never);

  const planInput: RunAiMarketingAgentInput = {
    organizationId: params.organizationId,
    userId: params.userId,
    provider: "hybrid",
    mode: routed.aiMode,
    campaignId: params.campaignId,
    goal: params.message,
    approvalMode: "auto_draft",
  };

  let plan;
  try {
    plan = await buildAiMarketingPlan(planInput);
  } catch {
    plan = {
      objective: routed.summary,
      steps: routed.suggestedPlaybookSteps.map((name) => ({
        name,
        tools_needed: [],
        records_to_create: [],
        approval_required: name.toLowerCase().includes("launch") || name.toLowerCase().includes("publish"),
        risk_level: "medium" as const,
      })),
      expected_outputs: ["Assigned workers", "Playbook steps"],
    };
  }

  const playbookSteps = routed.suggestedPlaybookSteps.map((name, index) => ({
    order: index + 1,
    name,
    worker_key: index === 0 ? routed.primaryWorker : (routed.supportingWorkers[index - 1] ?? routed.primaryWorker),
    status: "planned",
  }));

  const { data: playbook, error: playbookErr } = await params.db
    .from("mission_playbooks" as never)
    .insert({
      organization_id: params.organizationId,
      session_id: sessionId,
      campaign_id: params.campaignId ?? null,
      intent: routed.intent,
      status: "planned",
      steps: playbookSteps,
      result: { routed, plan },
    } as never)
    .select("id")
    .single();
  if (playbookErr) {
    // Table may not be migrated yet — continue without persistence
  }

  await syncAgentsAndTemplates(params.db as never, params.organizationId).catch(() => undefined);

  const assignedWorkers = [routed.primaryWorker, ...routed.supportingWorkers].map((key) => ({
    key,
    legacyAgentKey: resolveLegacyAgentKey(key as MissionWorkerKey),
  }));

  const assignedWorkerKeys = assignedWorkers.map((w) => w.key);
  const history = [...priorHistory, { role: "user" as const, content: params.message }];

  const { reply: assistantReply, suggestions } = await generateMissionControlReply({
    userMessage: params.message,
    history: priorHistory,
    routed,
    plan,
    assignedWorkerKeys,
    organizationId: params.organizationId,
    userId: params.userId,
  });

  await params.db.from("mission_control_messages" as never).insert({
    organization_id: params.organizationId,
    session_id: sessionId,
    role: "assistant",
    content: assistantReply,
    worker_key: routed.primaryWorker,
    intent: routed.intent,
    plan,
    metadata: {
      playbook_id: (playbook as { id?: string } | null)?.id ?? null,
      confidence: routed.confidence,
      suggestions,
    },
  } as never);

  try {
    await params.db
      .from("mission_control_sessions" as never)
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", sessionId)
      .eq("organization_id", params.organizationId);
  } catch {
    // session bump optional
  }

  await upsertBusinessMemory(params.db, {
    organizationId: params.organizationId,
    namespace: "conversation",
    scopeId: sessionId,
    memoryKey: "last_command",
    value: { message: params.message, routed, at: new Date().toISOString() },
  }).catch(() => undefined);

  return {
    sessionId,
    playbookId: (playbook as { id?: string } | null)?.id ?? null,
    routed,
    plan,
    assignedWorkers,
    reply: assistantReply,
    suggestions,
  };
}
