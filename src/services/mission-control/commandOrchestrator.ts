import type { SupabaseClient } from "@supabase/supabase-js";

import { routeMissionCommand } from "@/domain/mission-control/intentRouter";
import { resolveLegacyAgentKey } from "@/domain/mission-control/workerRegistry";
import type { MissionWorkerKey } from "@/domain/mission-control/types";
import { buildAiMarketingPlan } from "@/services/ai-agent/agentOrchestrator";
import type { RunAiMarketingAgentInput } from "@/services/ai-agent/types";
import { generateMissionControlReply } from "@/services/mission-control/chatAssistant";
import { getBusinessMemory, upsertBusinessMemory } from "@/services/mission-control/memoryService";
import { historyFromRows, listSessionMessages } from "@/services/mission-control/sessionService";
import {
  buildIntakeQuestionReply,
  computeMissingForFastLaunch,
  extractIntakePatchFromMessage,
  mergeIntake,
  type MissionControlIntake,
} from "@/services/mission-control/intakeService";
import { syncAgentsAndTemplates } from "@/services/openclaw/orchestrationService";
import { encryptJson } from "@/services/platforms/credentialsCrypto";
import { writeAuditLog } from "@/services/audit/auditService";

export async function processMissionCommand(params: {
  db: SupabaseClient;
  organizationId: string;
  userId: string;
  message: string;
  sessionId?: string;
  campaignId?: string;
}) {
  const rawMessage = params.message.trim();
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

  // Load and update intake memory for the session. This drives the chatbot pre-questions.
  let intake: MissionControlIntake = {};
  try {
    const existing = await getBusinessMemory(params.db, {
      organizationId: params.organizationId,
      namespace: "conversation",
      scopeId: sessionId,
      memoryKey: "mc_intake",
    });
    intake = (existing?.value ?? {}) as MissionControlIntake;
  } catch {
    intake = {};
  }
  const patch = extractIntakePatchFromMessage(rawMessage);
  intake = mergeIntake(intake, patch);
  await upsertBusinessMemory(params.db, {
    organizationId: params.organizationId,
    namespace: "conversation",
    scopeId: sessionId,
    memoryKey: "mc_intake",
    value: intake as unknown as Record<string, unknown>,
  }).catch(() => undefined);

  await params.db.from("mission_control_messages" as never).insert({
    organization_id: params.organizationId,
    session_id: sessionId,
    role: "user",
    content: params.message,
    intent: routed.intent,
    metadata: { campaign_id: params.campaignId ?? null },
  } as never);

  // Zernio connect flow: if user asks to connect, prompt for API key; if they paste a key after prompt, save it.
  if (intake.wantsConnectZernio) {
    await upsertBusinessMemory(params.db, {
      organizationId: params.organizationId,
      namespace: "conversation",
      scopeId: sessionId,
      memoryKey: "mc_pending_action",
      value: { type: "connect_zernio_mcp", at: new Date().toISOString() },
    }).catch(() => undefined);
  }

  let pendingAction: { type?: string } | null = null;
  try {
    const existing = await getBusinessMemory(params.db, {
      organizationId: params.organizationId,
      namespace: "conversation",
      scopeId: sessionId,
      memoryKey: "mc_pending_action",
    });
    pendingAction = existing?.value ?? null;
  } catch {
    pendingAction = null;
  }

  const looksLikeApiKey = rawMessage.length >= 20 && !rawMessage.includes(" ") && !rawMessage.includes("http");
  if (pendingAction?.type === "connect_zernio_mcp" && looksLikeApiKey) {
    let ok = false;
    try {
      const encrypted = encryptJson({ api_key: rawMessage });
      const status = { connected: true, missing: [] as string[] };
      const { error } = await params.db
        .from("organization_ad_credentials" as never)
        .upsert(
          {
            organization_id: params.organizationId,
            platform: "zernio_mcp",
            encrypted,
            status,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "organization_id,platform" },
        );
      if (!error) ok = true;
      await writeAuditLog({
        organizationId: params.organizationId,
        actorUserId: params.userId,
        action: "settings.updated",
        entityType: "zernio_mcp",
        entityId: "zernio_mcp",
        metadata: { connected: ok },
      }).catch(() => undefined);
    } catch {
      ok = false;
    }
    const assistantReply = ok
      ? "Great — Zernio MCP is connected for your organization. Which platform do you want to start with (Meta Ads or Google Ads), and what’s your budget?"
      : "I couldn’t save that Zernio key yet. Make sure `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` is set on the server, then try pasting the key again.";

    await params.db.from("mission_control_messages" as never).insert({
      organization_id: params.organizationId,
      session_id: sessionId,
      role: "assistant",
      content: assistantReply,
      worker_key: routed.primaryWorker,
      intent: routed.intent,
      plan: {},
      metadata: { suggestions: ["Meta Ads", "Google Ads", "$500 budget"] },
    } as never);

    await upsertBusinessMemory(params.db, {
      organizationId: params.organizationId,
      namespace: "conversation",
      scopeId: sessionId,
      memoryKey: "mc_pending_action",
      value: {},
    }).catch(() => undefined);

    return {
      sessionId,
      playbookId: null,
      routed,
      plan: null,
      assignedWorkers: [],
      reply: assistantReply,
      suggestions: ["Meta Ads", "Google Ads", "$500 budget"],
    };
  }

  // If we're missing key inputs, ask pre-questions (fast launch) instead of generating a full plan.
  const missing = computeMissingForFastLaunch(intake);
  if (missing.length > 0 && ["create_campaign", "build_funnel", "create_ads", "lead_generation_playbook"].includes(routed.intent)) {
    const { reply, suggestions } = buildIntakeQuestionReply({ missing, intake });
    await params.db.from("mission_control_messages" as never).insert({
      organization_id: params.organizationId,
      session_id: sessionId,
      role: "assistant",
      content: reply,
      worker_key: routed.primaryWorker,
      intent: routed.intent,
      plan: {},
      metadata: { suggestions },
    } as never);
    return {
      sessionId,
      playbookId: null,
      routed,
      plan: null,
      assignedWorkers: [],
      reply,
      suggestions,
    };
  }

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
