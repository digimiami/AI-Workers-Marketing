import type { SupabaseClient } from "@supabase/supabase-js";

import { createPendingRun, executePendingRun, syncAgentsAndTemplates } from "@/services/openclaw/orchestrationService";

type Db = SupabaseClient;

async function getCursor(db: Db, organizationId: string): Promise<string | null> {
  const { data } = await db
    .from("settings" as never)
    .select("value")
    .eq("organization_id", organizationId)
    .eq("key", "growth_os_event_cursor")
    .maybeSingle();
  const v = (data as any)?.value as Record<string, unknown> | undefined;
  const iso = typeof v?.last_processed_at === "string" ? (v.last_processed_at as string) : null;
  return iso;
}

async function setCursor(db: Db, organizationId: string, iso: string) {
  await db.from("settings" as never).upsert(
    {
      organization_id: organizationId,
      key: "growth_os_event_cursor",
      value: { last_processed_at: iso },
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "organization_id,key" },
  );
}

async function resolveOperatorUserId(db: Db, organizationId: string): Promise<string | null> {
  const { data: member } = await db
    .from("organization_members" as never)
    .select("user_id")
    .eq("organization_id", organizationId)
    .in("role", ["admin", "operator"])
    .limit(1)
    .maybeSingle();
  return (member as any)?.user_id ? String((member as any).user_id) : null;
}

async function agentIdForKey(db: Db, organizationId: string, key: string): Promise<string | null> {
  const { data: agent } = await db
    .from("agents" as never)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("key", key)
    .maybeSingle();
  return (agent as any)?.id ? String((agent as any).id) : null;
}

/**
 * Event-driven automation loop (revenue-first):
 * - lead_submit -> CRM/Closing + Nurture run
 * - affiliate_click spike -> Conversion/Analytics run
 *
 * Reads analytics_events since last cursor and triggers agent runs with traceability.
 */
export async function processGrowthOsEvents(
  db: Db,
  opts: { organizationId?: string; limit?: number },
): Promise<{ processed: number; triggered_runs: number; cursor: string }> {
  const limit = opts.limit ?? 200;

  // Determine organizations in scope.
  const orgIds: string[] = [];
  if (opts.organizationId) {
    orgIds.push(opts.organizationId);
  } else {
    const { data: orgs } = await db.from("organizations" as never).select("id").limit(200);
    for (const o of orgs ?? []) {
      const id = (o as any)?.id ? String((o as any).id) : null;
      if (id) orgIds.push(id);
    }
  }

  let processed = 0;
  let triggered_runs = 0;
  const now = new Date().toISOString();

  for (const organizationId of orgIds) {
    // Ensure agents exist in this org (idempotent).
    await syncAgentsAndTemplates(db as any, organizationId);

    const actorUserId = await resolveOperatorUserId(db, organizationId);
    if (!actorUserId) continue;

    const since = (await getCursor(db, organizationId)) ?? new Date(Date.now() - 15 * 60_000).toISOString();

    const { data: events, error } = await db
      .from("analytics_events" as never)
      .select("id,created_at,event_name,campaign_id,lead_id,metadata,properties,source")
      .eq("organization_id", organizationId)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) continue;

    let lastSeen = since;
    for (const e of events ?? []) {
      processed += 1;
      const createdAt = String((e as any).created_at ?? "");
      if (createdAt) lastSeen = createdAt;

      const eventName = String((e as any).event_name ?? "");
      const campaignId = (e as any).campaign_id ? String((e as any).campaign_id) : null;
      const leadId = (e as any).lead_id ? String((e as any).lead_id) : null;

      // Revenue-first: new lead => run nurture + closer (drafts only; sending gated elsewhere)
      if (eventName === "lead_submit" && campaignId && leadId) {
        for (const key of ["lead_nurture_worker", "conversion_worker"] as const) {
          const aid = await agentIdForKey(db, organizationId, key);
          if (!aid) continue;
          const run = await createPendingRun(db as any, {
            organizationId,
            agentId: aid,
            campaignId,
            input: {
              trace_id: `trace_growth_${eventName}_${(e as any).id}`,
              purpose: `growth_os_${eventName}`,
              lead_id: leadId,
              campaign_id: campaignId,
              event_id: (e as any).id,
              source: "growth_os_event_runner",
            },
            templateId: null,
            actorUserId,
          });
          await executePendingRun(db as any, { organizationId, runId: (run as any).id, actorUserId });
          triggered_runs += 1;
        }
      }

      // Click spike => analyst recap (conversion diagnosis)
      if (eventName === "affiliate_click" && campaignId) {
        const aid = await agentIdForKey(db, organizationId, "analyst_worker");
        if (!aid) continue;
        const run = await createPendingRun(db as any, {
          organizationId,
          agentId: aid,
          campaignId,
          input: {
            trace_id: `trace_growth_${eventName}_${(e as any).id}`,
            purpose: `growth_os_${eventName}`,
            campaign_id: campaignId,
            event_id: (e as any).id,
            source: "growth_os_event_runner",
          },
          templateId: null,
          actorUserId,
        });
        await executePendingRun(db as any, { organizationId, runId: (run as any).id, actorUserId });
        triggered_runs += 1;
      }
    }

    await setCursor(db, organizationId, lastSeen || now);
  }

  return { processed, triggered_runs, cursor: now };
}

