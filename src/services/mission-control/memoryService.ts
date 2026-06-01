import type { SupabaseClient } from "@supabase/supabase-js";

export type MemoryNamespace = "user" | "business" | "campaign" | "conversation" | "task" | "agent";

export async function upsertBusinessMemory(
  db: SupabaseClient,
  params: {
    organizationId: string;
    namespace: MemoryNamespace;
    memoryKey: string;
    value: Record<string, unknown>;
    scopeId?: string | null;
    source?: string;
  },
) {
  const row = {
    organization_id: params.organizationId,
    namespace: params.namespace,
    scope_id: params.scopeId ?? null,
    memory_key: params.memoryKey,
    value: params.value,
    source: params.source ?? "mission_control",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("business_memory" as never)
    .upsert(row as never, { onConflict: "organization_id,namespace,scope_id,memory_key" })
    .select("id,memory_key,namespace,updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getBusinessMemory(
  db: SupabaseClient,
  params: {
    organizationId: string;
    namespace: MemoryNamespace;
    memoryKey: string;
    scopeId?: string | null;
  },
) {
  let q = db
    .from("business_memory" as never)
    .select("id,memory_key,value,namespace,updated_at")
    .eq("organization_id", params.organizationId)
    .eq("namespace", params.namespace)
    .eq("memory_key", params.memoryKey);

  if (params.scopeId) {
    q = q.eq("scope_id", params.scopeId);
  } else {
    q = q.is("scope_id", null);
  }

  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; memory_key: string; value: Record<string, unknown> } | null;
}
