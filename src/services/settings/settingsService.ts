import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

export type SettingRow = {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
};

export async function listSettings(db: Db, organizationId: string): Promise<SettingRow[]> {
  const { data, error } = await db
    .from("settings" as never)
    .select("key,value,updated_at")
    .eq("organization_id", organizationId)
    .order("key", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SettingRow[];
}

export async function upsertSetting(
  db: Db,
  organizationId: string,
  key: string,
  value: Record<string, unknown>,
): Promise<SettingRow> {
  const { data, error } = await db
    .from("settings" as never)
    .upsert(
      {
        organization_id: organizationId,
        key,
        value,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "organization_id,key" },
    )
    .select("key,value,updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data as SettingRow;
}
