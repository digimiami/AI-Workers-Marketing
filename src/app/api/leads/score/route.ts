import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { scoreLeadWithAi } from "@/services/growth/leadPipelineService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  leadId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
});

const STATUS_MAP: Record<string, string> = {
  new_lead: "new",
  engaged: "contacted",
  hot: "qualified",
  booked: "qualified",
  converted: "won",
  lost: "lost",
};

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const { organizationId, leadId, campaignId } = parsed.data;

  const { data: lead, error: lErr } = await admin
    .from("leads" as never)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", leadId)
    .maybeSingle();
  if (lErr || !lead) return NextResponse.json({ ok: false, message: lErr?.message ?? "Lead not found" }, { status: 404 });

  const { data: events } = await admin
    .from("lead_events" as never)
    .select("event_type,metadata,created_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(40);

  let camp: Record<string, unknown> | null = null;
  if (campaignId) {
    const { data, error: campErr } = await admin
      .from("campaigns" as never)
      .select("id,name,metadata")
      .eq("organization_id", organizationId)
      .eq("id", campaignId)
      .maybeSingle();
    if (!campErr && data) camp = data as Record<string, unknown>;
  }

  const ai = await scoreLeadWithAi({
    lead: lead as Record<string, unknown>,
    campaign: camp ? (camp as Record<string, unknown>) : null,
    recentEvents: ((events ?? []) as Record<string, unknown>[]) ?? [],
  });

  const stage = typeof ai.stage === "string" ? ai.stage : "new_lead";
  const score = typeof ai.score === "number" && Number.isFinite(ai.score) ? Math.round(ai.score) : 0;
  const nextStatus = STATUS_MAP[stage] ?? "new";

  const prevMeta = asMetadataRecord((lead as { metadata?: unknown }).metadata);
  const nextLeadMeta = mergeJsonbRecords(prevMeta, {
    growth_ai: { stage, intentLevel: ai.intentLevel, nextBestAction: ai.nextBestAction, notes: ai.notes, scored_at: new Date().toISOString() },
  });

  await admin
    .from("leads" as never)
    .update({
      score,
      status: nextStatus,
      metadata: nextLeadMeta,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("organization_id", organizationId)
    .eq("id", leadId);

  const { error: sErr } = await admin.from("lead_scores" as never).insert({
    organization_id: organizationId,
    lead_id: leadId,
    campaign_id: campaignId ?? (lead as { campaign_id?: string | null }).campaign_id ?? null,
    score,
    stage,
    intent_level: typeof ai.intentLevel === "string" ? ai.intentLevel : null,
    next_best_action: typeof ai.nextBestAction === "string" ? ai.nextBestAction : null,
    metadata: { automationTrigger: ai.automationTrigger ?? null, notes: ai.notes ?? null },
  } as never);
  if (sErr) return NextResponse.json({ ok: false, message: sErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, scoring: ai });
}
