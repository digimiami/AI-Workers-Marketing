import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

export type CampaignAutomationSettings = {
  campaign_id: string;
  automation_enabled: boolean;
  auto_generate_content_drafts: boolean;
  auto_run_analyst_weekly: boolean;
  require_approval_before_publish: boolean;
  require_approval_before_email: boolean;
  auto_log_analytics_reviews: boolean;
  max_runs_per_day: number;
  updated_at: string;
};

const campaignAutomationSelectCols =
  "campaign_id,automation_enabled,auto_generate_content_drafts,auto_run_analyst_weekly,require_approval_before_publish,require_approval_before_email,auto_log_analytics_reviews,max_runs_per_day,updated_at";

export async function getCampaignAutomationSettings(
  db: Db,
  organizationId: string,
  campaignId: string,
): Promise<CampaignAutomationSettings | null> {
  const { data, error } = await db
    .from("campaign_automation_settings" as never)
    .select(campaignAutomationSelectCols as never)
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (error) {
    const msg = String((error as any)?.message ?? "");
    const missingTable =
      /relation .*campaign_automation_settings.* does not exist/i.test(msg) ||
      /Could not find the 'campaign_automation_settings' table/i.test(msg) ||
      /schema cache/i.test(msg);
    if (missingTable) return null;
    throw new Error(msg);
  }
  return (data as any) ?? null;
}

export async function upsertCampaignAutomationSettings(
  db: Db,
  organizationId: string,
  body: Omit<CampaignAutomationSettings, "updated_at">,
) {
  const row = {
    organization_id: organizationId,
    campaign_id: body.campaign_id,
    automation_enabled: body.automation_enabled,
    auto_generate_content_drafts: body.auto_generate_content_drafts,
    auto_run_analyst_weekly: body.auto_run_analyst_weekly,
    require_approval_before_publish: body.require_approval_before_publish,
    require_approval_before_email: body.require_approval_before_email,
    auto_log_analytics_reviews: body.auto_log_analytics_reviews,
    max_runs_per_day: body.max_runs_per_day,
    updated_at: new Date().toISOString(),
  };

  // Prefer update-then-insert so we do not depend on PostgREST upsert + ON CONFLICT
  // matching a specific unique constraint (missing or renamed constraints caused 500s in prod).
  const { data: updated, error: updateErr } = await db
    .from("campaign_automation_settings" as never)
    .update(row as never)
    .eq("organization_id", organizationId)
    .eq("campaign_id", body.campaign_id)
    .select(campaignAutomationSelectCols as never)
    .maybeSingle();

  if (updateErr) {
    throw new Error(String((updateErr as { message?: string }).message ?? updateErr));
  }
  if (updated) return updated;

  const { data: inserted, error: insertErr } = await db
    .from("campaign_automation_settings" as never)
    .insert(row as never)
    .select(campaignAutomationSelectCols as never)
    .single();

  if (!insertErr) return inserted;

  const insertMsg = String((insertErr as { message?: string }).message ?? insertErr);
  if (/duplicate key|unique constraint/i.test(insertMsg)) {
    const { data: afterRace, error: retryErr } = await db
      .from("campaign_automation_settings" as never)
      .update(row as never)
      .eq("organization_id", organizationId)
      .eq("campaign_id", body.campaign_id)
      .select(campaignAutomationSelectCols as never)
      .single();
    if (retryErr) {
      throw new Error(String((retryErr as { message?: string }).message ?? retryErr));
    }
    return afterRace;
  }

  throw new Error(insertMsg);
}

export async function listRunRecipes(db: Db, organizationId: string) {
  const { data, error } = await db
    .from("run_recipes" as never)
    .select("id,key,name,description,default_agent_key,default_payload,payload_schema,enabled,updated_at")
    .eq("organization_id", organizationId)
    .order("key", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertRunRecipe(
  db: Db,
  organizationId: string,
  recipe: {
    id?: string;
    key: string;
    name: string;
    description?: string | null;
    default_agent_key: string;
    default_payload?: Record<string, unknown>;
    payload_schema?: Record<string, unknown>;
    enabled?: boolean;
  },
) {
  const row = {
    id: recipe.id,
    organization_id: organizationId,
    key: recipe.key,
    name: recipe.name,
    description: recipe.description ?? null,
    default_agent_key: recipe.default_agent_key,
    default_payload: recipe.default_payload ?? {},
    payload_schema: recipe.payload_schema ?? {},
    enabled: recipe.enabled ?? true,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from("run_recipes" as never)
    .upsert(row as never, { onConflict: "organization_id,key" })
    .select("id,key,name,description,default_agent_key,default_payload,payload_schema,enabled,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

