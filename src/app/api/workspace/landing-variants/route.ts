import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { regenerateLandingVariantsForCampaign } from "@/services/growth/regenerateLandingVariants";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  action: z.enum(["list", "select", "regenerate"]),
  variantId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const { organizationId, campaignId, action } = parsed.data;
  const orgCtx = await withOrgOperator(organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();

  if (action === "list") {
    const { data, error } = await admin
      .from("landing_page_variants" as never)
      .select("id,variant_key,angle,selected,status,created_at,updated_at,funnel_step_id,content")
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    const rows = (data ?? []) as any[];
    const stepIds = Array.from(new Set(rows.map((r) => (r.funnel_step_id ? String(r.funnel_step_id) : null)).filter(Boolean))) as string[];
    let slug: string | null = null;
    if (stepIds.length) {
      const { data: steps } = await admin
        .from("funnel_steps" as never)
        .select("id,slug,step_type")
        .eq("organization_id", organizationId)
        .in("id", stepIds)
        .limit(50);
      const landing = ((steps ?? []) as any[]).find((s) => String(s.step_type) === "landing") ?? (steps ?? [])[0];
      slug = landing?.slug ? String(landing.slug) : null;
    }

    const { data: campRow } = await admin
      .from("campaigns" as never)
      .select("metadata")
      .eq("organization_id", organizationId)
      .eq("id", campaignId)
      .maybeSingle();
    const meta = ((campRow as { metadata?: unknown } | null)?.metadata ?? {}) as Record<string, unknown>;
    const ge = (meta.growth_engine ?? {}) as Record<string, unknown>;
    const landingStatus = typeof ge.landing_status === "string" ? String(ge.landing_status) : null;
    const landingFix = (ge.landing_fix ?? null) as Record<string, unknown> | null;

    const variantsWithPreview = rows.map((r) => {
      const content = (r.content ?? {}) as Record<string, unknown>;
      const headline = typeof content.headline === "string" ? String(content.headline) : "";
      const subheadline = typeof content.subheadline === "string" ? String(content.subheadline) : "";
      const ctaText = typeof content.ctaText === "string" ? String(content.ctaText) : "";
      const benefitsCount = Array.isArray(content.benefits) ? (content.benefits as unknown[]).length : 0;
      return {
        id: r.id,
        variant_key: r.variant_key,
        angle: r.angle,
        selected: r.selected,
        status: r.status,
        funnel_step_id: r.funnel_step_id,
        preview: { headline, subheadline, ctaText, benefitsCount },
      };
    });

    return NextResponse.json({
      ok: true,
      variants: variantsWithPreview,
      landingSlug: slug,
      landingStatus,
      landingFix,
    });
  }

  if (action === "regenerate") {
    const overrideUrl = typeof (json as { url?: unknown })?.url === "string" ? String((json as { url?: string }).url) : "";
    const overrideGoal = typeof (json as { goal?: unknown })?.goal === "string" ? String((json as { goal?: string }).goal) : "";
    const overrideAudience =
      typeof (json as { audience?: unknown })?.audience === "string" ? String((json as { audience?: string }).audience) : "";
    const overrideTraffic =
      typeof (json as { trafficSource?: unknown })?.trafficSource === "string"
        ? String((json as { trafficSource?: string }).trafficSource)
        : "";

    const { data: campRow } = await admin
      .from("campaigns" as never)
      .select("metadata,name")
      .eq("organization_id", organizationId)
      .eq("id", campaignId)
      .maybeSingle();
    const meta = ((campRow as { metadata?: unknown } | null)?.metadata ?? {}) as Record<string, unknown>;
    const ge = (meta.growth_engine ?? {}) as Record<string, unknown>;

    const url = overrideUrl || (typeof meta.url === "string" ? String(meta.url) : "");
    const goal = overrideGoal || (typeof meta.goal === "string" ? String(meta.goal) : "");
    const audience = overrideAudience || (typeof meta.audience === "string" ? String(meta.audience) : "");
    const trafficSource =
      overrideTraffic ||
      (typeof meta.traffic_source === "string"
        ? String(meta.traffic_source)
        : typeof ge.traffic_source === "string"
          ? String(ge.traffic_source)
          : "");

    if (!url || !goal || !audience || !trafficSource) {
      return NextResponse.json(
        {
          ok: false,
          message: "Missing url/goal/audience/trafficSource — campaign metadata is incomplete.",
        },
        { status: 400 },
      );
    }

    const result = await regenerateLandingVariantsForCampaign({
      admin,
      input: { organizationId, campaignId, url, goal, audience, trafficSource },
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          needsGenerationFix: true,
          reason: result.reason,
          message: result.message,
          rejections: result.rejections,
        },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      variantsWritten: result.variantsWritten,
      keys: result.keys,
      finalUrl: result.finalUrl,
    });
  }

  const variantId = parsed.data.variantId;
  if (!variantId) return NextResponse.json({ ok: false, message: "variantId required" }, { status: 400 });

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

  const funnelStepId = (stepRow as any)?.funnel_step_id ? String((stepRow as any).funnel_step_id) : null;
  const variantKey = String((stepRow as any)?.variant_key ?? "");

  if (funnelStepId && variantKey) {
    const { data: step } = await admin
      .from("funnel_steps" as never)
      .select("metadata")
      .eq("organization_id", organizationId)
      .eq("id", funnelStepId)
      .maybeSingle();
    const prev = asMetadataRecord((step as any)?.metadata);
    const next = mergeJsonbRecords(prev, { page: { kind: "structured", variant_key: variantKey } });
    await admin
      .from("funnel_steps" as never)
      .update({
        metadata: next,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("organization_id", organizationId)
      .eq("id", funnelStepId);
  }

  return NextResponse.json({ ok: true, selected: updated });
}
