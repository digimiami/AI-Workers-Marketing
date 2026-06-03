import type { SupabaseClient } from "@supabase/supabase-js";

import { getRegistryEntry } from "@/lib/openclaw/registry";

type Db = SupabaseClient;

export async function getCatalogAgent(db: Db, slug: string) {
  const { data, error } = await db
    .from("agent_catalog" as never)
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

async function provisionOpenClawAgent(
  db: Db,
  organizationId: string,
  openclawKey: string,
) {
  const def = getRegistryEntry(openclawKey);
  if (!def) throw new Error(`Unknown OpenClaw agent key: ${openclawKey}`);

  const { data: agent, error } = await db
    .from("agents" as never)
    .upsert(
      {
        organization_id: organizationId,
        key: def.key,
        name: def.name,
        description: def.description,
        status: "enabled",
        approval_required: def.defaultApprovalRequired,
        allowed_tools: def.allowedTools,
        input_schema: def.inputSchema,
        output_schema: def.outputSchema,
      } as never,
      { onConflict: "organization_id,key" },
    )
    .select("id")
    .single();

  if (error || !agent) throw new Error(error?.message ?? "Failed to provision agent");
  const agentId = (agent as { id: string }).id;

  const { data: existingTpl } = await db
    .from("agent_templates" as never)
    .select("id")
    .eq("agent_id", agentId)
    .eq("is_default", true)
    .maybeSingle();

  if (!existingTpl) {
    await db.from("agent_templates" as never).insert({
      organization_id: organizationId,
      agent_id: agentId,
      name: "Default",
      system_prompt: def.defaultSystemPrompt,
      style_rules: def.defaultStyleRules,
      forbidden_claims: def.defaultForbiddenClaims,
      output_format: def.defaultOutputFormat,
      is_default: true,
      version: 1,
    } as never);
  }

  return agentId;
}

async function installPlatformSkills(
  db: Db,
  organizationId: string,
  skillKeys: string[],
) {
  if (!skillKeys.length) return;

  const { data: platformSkills, error } = await db
    .from("platform_skills" as never)
    .select("skill_key,name,markdown,agent_slug")
    .in("skill_key", skillKeys)
    .eq("status", "published");

  if (error) throw new Error(error.message);
  const rows = (platformSkills ?? []) as Array<{
    skill_key: string;
    name: string;
    markdown: string;
    agent_slug: string | null;
  }>;

  for (const skill of rows) {
    await db.from("ai_worker_skills" as never).upsert(
      {
        organization_id: organizationId,
        skill_key: skill.skill_key,
        stage_key: skill.agent_slug,
        name: skill.name,
        markdown: skill.markdown,
        status: "enabled",
        version: 1,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "organization_id,skill_key" },
    );
  }
}

/** Provision a purchased agent onto an organization account. */
export async function provisionAgentForOrganization(
  db: Db,
  params: {
    organizationId: string;
    agentCatalogSlug: string;
    licenseId?: string;
    source?: string;
  },
) {
  const catalog = await getCatalogAgent(db, params.agentCatalogSlug);
  if (!catalog) throw new Error("AGENT_NOT_IN_CATALOG");

  const openclawKey = String(catalog.openclaw_agent_key);
  const includedSkills = (catalog.included_skill_keys as string[]) ?? [];

  const agentId = await provisionOpenClawAgent(db, params.organizationId, openclawKey);
  await installPlatformSkills(db, params.organizationId, includedSkills);

  const now = new Date().toISOString();

  if (params.licenseId) {
    await db
      .from("organization_agent_licenses" as never)
      .update({
        status: "active",
        provisioned_agent_id: agentId,
        provisioned_at: now,
        updated_at: now,
      } as never)
      .eq("id", params.licenseId);
  } else {
    await db.from("organization_agent_licenses" as never).upsert(
      {
        organization_id: params.organizationId,
        agent_catalog_slug: params.agentCatalogSlug,
        status: "active",
        source: params.source ?? "admin",
        provisioned_agent_id: agentId,
        provisioned_at: now,
        updated_at: now,
      } as never,
      { onConflict: "organization_id,agent_catalog_slug" },
    );
  }

  return { agentId, openclawKey, catalogSlug: params.agentCatalogSlug };
}

export async function listOrganizationAgentLicenses(db: Db, organizationId: string) {
  const { data, error } = await db
    .from("organization_agent_licenses" as never)
    .select(
      "id,agent_catalog_slug,status,source,provisioned_agent_id,provisioned_at,created_at,agent_catalog(title,short_title,tagline,openclaw_agent_key)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
