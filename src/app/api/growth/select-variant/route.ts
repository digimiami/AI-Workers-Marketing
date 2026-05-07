import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  variantId: z.string().uuid(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const { organizationId, campaignId, variantId } = parsed.data;

  await admin
    .from("landing_page_variants" as never)
    .update({ selected: false, updated_at: new Date().toISOString() } as never)
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId);

  const { data: updated, error } = await admin
    .from("landing_page_variants" as never)
    .update({ selected: true, updated_at: new Date().toISOString() } as never)
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .eq("id", variantId)
    .select("id,variant_key,selected")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const { data: stepRow } = await admin
    .from("landing_page_variants" as never)
    .select("funnel_step_id,variant_key")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .eq("id", variantId)
    .maybeSingle();

  const funnelStepId = (stepRow as { funnel_step_id?: string } | null)?.funnel_step_id
    ? String((stepRow as { funnel_step_id: string }).funnel_step_id)
    : null;
  const variantKey = String((stepRow as { variant_key?: string } | null)?.variant_key ?? "");

  if (funnelStepId && variantKey) {
    const { data: step } = await admin
      .from("funnel_steps" as never)
      .select("metadata")
      .eq("organization_id", organizationId)
      .eq("id", funnelStepId)
      .maybeSingle();
    const prev = asMetadataRecord((step as { metadata?: unknown } | null)?.metadata);
    const next = mergeJsonbRecords(prev, { page: { kind: "structured", variant_key: variantKey } });
    await admin
      .from("funnel_steps" as never)
      .update({ metadata: next, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", organizationId)
      .eq("id", funnelStepId);
  }

  const { data: camp } = await admin.from("campaigns" as never).select("metadata").eq("id", campaignId).maybeSingle();
  const prevMeta = asMetadataRecord((camp as { metadata?: unknown } | null)?.metadata);
  const ge = asMetadataRecord(prevMeta.growth_engine);
  const nextMeta = mergeJsonbRecords(prevMeta, {
    growth_engine: {
      ...ge,
      selected_variant_key: variantKey || ge.selected_variant_key,
      traffic_routing: { ...(asMetadataRecord(ge.traffic_routing) as object), mode: "manual_winner" },
    },
  });
  await admin
    .from("campaigns" as never)
    .update({ metadata: nextMeta, updated_at: new Date().toISOString() } as never)
    .eq("organization_id", organizationId)
    .eq("id", campaignId);

  return NextResponse.json({ ok: true, selected: updated });
}
