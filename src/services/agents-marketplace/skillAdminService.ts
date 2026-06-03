import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

export async function listPlatformSkills(db: Db, filters?: { agentSlug?: string }) {
  let q = db
    .from("platform_skills" as never)
    .select("*")
    .order("featured", { ascending: false })
    .order("name", { ascending: true });

  if (filters?.agentSlug) {
    q = q.eq("agent_slug", filters.agentSlug);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertPlatformSkill(
  db: Db,
  row: {
    skill_key: string;
    name: string;
    category: string;
    description: string;
    markdown: string;
    agent_slug?: string | null;
    status?: string;
    featured?: boolean;
  },
) {
  const { data, error } = await db
    .from("platform_skills" as never)
    .upsert(
      {
        skill_key: row.skill_key,
        name: row.name,
        category: row.category,
        description: row.description,
        markdown: row.markdown,
        agent_slug: row.agent_slug ?? null,
        status: row.status ?? "published",
        featured: row.featured ?? false,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "skill_key" },
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listAgentCatalog(db: Db) {
  const { data, error } = await db
    .from("agent_catalog" as never)
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateAgentCatalog(
  db: Db,
  slug: string,
  patch: {
    stripe_price_id?: string | null;
    status?: string;
    included_skill_keys?: string[];
    monthly_price_cents?: number;
  },
) {
  const { data, error } = await db
    .from("agent_catalog" as never)
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("slug", slug)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
