import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { pickSuggestedWinner, scoreLandingVariantContent } from "@/services/growth/variantScoringEngine";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("landing_page_variants" as never)
    .select("id,variant_key,content")
    .eq("organization_id", parsed.data.organizationId)
    .eq("campaign_id", parsed.data.campaignId)
    .limit(20);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const list = (rows ?? []) as Array<{ id: string; variant_key: string; content: unknown }>;
  const scored = list.map((r) => {
    const content = asMetadataRecord(r.content);
    return scoreLandingVariantContent({
      variantId: r.id,
      variantKey: r.variant_key,
      content,
    });
  });

  const suggested = pickSuggestedWinner(scored);
  const scoredAt = new Date().toISOString();

  const { data: camp } = await admin
    .from("campaigns" as never)
    .select("metadata")
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", parsed.data.campaignId)
    .maybeSingle();
  const prev = asMetadataRecord((camp as { metadata?: unknown } | null)?.metadata);
  const ge = asMetadataRecord(prev.growth_engine);
  const nextMeta = mergeJsonbRecords(prev, {
    growth_engine: {
      ...ge,
      variant_scoring: {
        scored_at: scoredAt,
        engine: "heuristic_v1",
        variants: scored,
        suggested_winner: suggested,
      },
    },
  });

  await admin
    .from("campaigns" as never)
    .update({ metadata: nextMeta, updated_at: new Date().toISOString() } as never)
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", parsed.data.campaignId);

  return NextResponse.json({ ok: true, scoredAt, scored, suggestedWinner: suggested });
}
