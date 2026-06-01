import type { SupabaseClient } from "@supabase/supabase-js";

export type MissionControlMessageRow = {
  id: string;
  role: string;
  content: string;
  worker_key: string | null;
  intent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function listSessionMessages(
  db: SupabaseClient,
  organizationId: string,
  sessionId: string,
  limit = 80,
): Promise<MissionControlMessageRow[]> {
  const { data, error } = await db
    .from("mission_control_messages" as never)
    .select("id,role,content,worker_key,intent,metadata,created_at")
    .eq("organization_id", organizationId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MissionControlMessageRow[];
}

export async function listRecentSessions(db: SupabaseClient, organizationId: string, limit = 12) {
  const { data, error } = await db
    .from("mission_control_sessions" as never)
    .select("id,title,status,updated_at,created_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function historyFromRows(rows: MissionControlMessageRow[]) {
  return rows
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}
