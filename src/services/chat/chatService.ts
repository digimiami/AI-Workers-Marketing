import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/services/audit/auditService";

type Db = SupabaseClient;

export async function createConversation(
  db: Db,
  params: {
    organizationId: string;
    campaignId?: string | null;
    funnelId?: string | null;
    funnelStepId?: string | null;
    sessionId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { data, error } = await db
    .from("chat_conversations" as never)
    .insert({
      organization_id: params.organizationId,
      campaign_id: params.campaignId ?? null,
      funnel_id: params.funnelId ?? null,
      funnel_step_id: params.funnelStepId ?? null,
      session_id: params.sessionId ?? null,
      status: "open",
      metadata: params.metadata ?? {},
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .select("id,status,lead_id,lead_score,created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as any;
}

export async function appendChatMessage(
  db: Db,
  params: {
    organizationId: string;
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { data, error } = await db
    .from("chat_messages" as never)
    .insert({
      organization_id: params.organizationId,
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      metadata: params.metadata ?? {},
    } as never)
    .select("id,role,content,created_at")
    .single();
  if (error) throw new Error(error.message);

  await db
    .from("chat_conversations" as never)
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
    .eq("organization_id", params.organizationId)
    .eq("id", params.conversationId);

  return data as any;
}

export async function listConversationMessages(
  db: Db,
  organizationId: string,
  conversationId: string,
  limit = 50,
) {
  const { data, error } = await db
    .from("chat_messages" as never)
    .select("id,role,content,metadata,created_at")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

export async function markConversationConverted(
  db: Db,
  params: { organizationId: string; conversationId: string; leadId: string; leadScore: number; actorUserId?: string | null },
) {
  await db
    .from("chat_conversations" as never)
    .update({
      status: "converted",
      lead_id: params.leadId,
      lead_score: params.leadScore,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("organization_id", params.organizationId)
    .eq("id", params.conversationId);

  if (params.actorUserId) {
    await writeAuditLog({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: "lead.updated",
      entityType: "chat_conversation",
      entityId: params.conversationId,
      metadata: { lead_id: params.leadId, lead_score: params.leadScore },
    });
  }
}

