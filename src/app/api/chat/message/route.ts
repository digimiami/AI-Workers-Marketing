import { NextResponse } from "next/server";

import crypto from "crypto";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executePendingRun } from "@/services/openclaw/orchestrationService";
import { appendChatMessage, createConversation, listConversationMessages } from "@/services/chat/chatService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  funnelId: z.string().uuid().optional(),
  funnelStepId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  message: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Supabase not configured" },
      { status: 503 },
    );
  }

  // Create or load conversation (org-scoped).
  let conversationId = parsed.data.conversationId ?? null;
  if (!conversationId) {
    const conv = await createConversation(admin as any, {
      organizationId: parsed.data.organizationId,
      campaignId: parsed.data.campaignId ?? null,
      funnelId: parsed.data.funnelId ?? null,
      funnelStepId: parsed.data.funnelStepId ?? null,
      sessionId: parsed.data.sessionId ?? null,
      metadata: { source: "public_chat_widget" },
    });
    conversationId = String((conv as any).id);
  }

  await appendChatMessage(admin as any, {
    organizationId: parsed.data.organizationId,
    conversationId,
    role: "user",
    content: parsed.data.message,
    metadata: { session_id: parsed.data.sessionId ?? null },
  });

  await admin.from("analytics_events" as any).insert({
    organization_id: parsed.data.organizationId,
    campaign_id: parsed.data.campaignId ?? null,
    funnel_id: parsed.data.funnelId ?? null,
    event_name: "chat_message",
    source: "public.chat",
    metadata: { conversation_id: conversationId, role: "user" },
  } as any);

  // Create a run for chat closer worker for this message.
  const { data: agent } = await admin
    .from("agents" as any)
    .select("id")
    .eq("organization_id", parsed.data.organizationId)
    .eq("key", "chat_closer_worker")
    .maybeSingle();
  const agentRow = agent as any;
  if (!agentRow?.id) {
    // fallback: simple stub reply without LLM
    const reply = "Thanks — what’s your goal: more leads, booked calls, or affiliate clicks?";
    await appendChatMessage(admin as any, {
      organizationId: parsed.data.organizationId,
      conversationId,
      role: "assistant",
      content: reply,
      metadata: { provider_mode: "fallback" },
    });
    return NextResponse.json({ ok: true, conversationId, reply });
  }

  const traceId = `trace_chat_${crypto.randomUUID()}`;
  const messages = await listConversationMessages(admin as any, parsed.data.organizationId, conversationId, 30);

  const { data: run } = await admin
    .from("agent_runs" as any)
    .insert({
      organization_id: parsed.data.organizationId,
      agent_id: String(agentRow.id),
      campaign_id: parsed.data.campaignId ?? null,
      status: "pending",
      input: {
        trace_id: traceId,
        purpose: "chat_closer_message",
        conversation_id: conversationId,
        campaign_id: parsed.data.campaignId ?? null,
        funnel_id: parsed.data.funnelId ?? null,
        funnel_step_id: parsed.data.funnelStepId ?? null,
        session_id: parsed.data.sessionId ?? null,
        messages,
      },
    } as any)
    .select("id")
    .single();

  // Execute immediately (stub/live provider abstraction handled inside executePendingRun).
  const { data: member } = await admin
    .from("organization_members" as any)
    .select("user_id")
    .eq("organization_id", parsed.data.organizationId)
    .in("role", ["admin", "operator"])
    .limit(1)
    .maybeSingle();
  await executePendingRun(admin as any, {
    organizationId: parsed.data.organizationId,
    runId: String((run as any).id),
    actorUserId: (member as any)?.user_id ? String((member as any).user_id) : crypto.randomUUID(),
  });

  // Read latest output summary or fallback
  const { data: outs } = await admin
    .from("agent_outputs" as any)
    .select("content")
    .eq("organization_id", parsed.data.organizationId)
    .eq("run_id", String((run as any).id))
    .order("created_at", { ascending: false })
    .limit(1);
  const content = (outs?.[0] as any)?.content ?? {};
  const reply = typeof content.next_message === "string" ? content.next_message : "Got it. What’s your budget and timeline?";

  await appendChatMessage(admin as any, {
    organizationId: parsed.data.organizationId,
    conversationId,
    role: "assistant",
    content: reply,
    metadata: { trace_id: traceId, run_id: String((run as any).id) },
  });

  await admin.from("analytics_events" as any).insert({
    organization_id: parsed.data.organizationId,
    campaign_id: parsed.data.campaignId ?? null,
    funnel_id: parsed.data.funnelId ?? null,
    event_name: "chat_message",
    source: "public.chat",
    metadata: { conversation_id: conversationId, role: "assistant" },
  } as any);

  return NextResponse.json({ ok: true, conversationId, reply });
}
