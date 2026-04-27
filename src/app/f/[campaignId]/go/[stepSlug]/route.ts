import { NextResponse } from "next/server";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ campaignId: string; stepSlug: string }> },
) {
  const { campaignId, stepSlug } = await ctx.params;
  if (!z.string().uuid().safeParse(campaignId).success) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const admin = createSupabaseAdminClient();
  const { data: camp } = await admin
    .from("campaigns" as never)
    .select("id,organization_id,funnel_id")
    .eq("id", campaignId)
    .maybeSingle();

  const funnelId = (camp as any)?.funnel_id ? String((camp as any).funnel_id) : null;
  if (!funnelId) return NextResponse.json({ ok: false, message: "Missing funnel" }, { status: 404 });

  // If stepSlug isn't a CTA step, redirect via the first CTA step in the funnel.
  const { data: step } = await admin
    .from("funnel_steps" as never)
    .select("id,slug,step_type,metadata")
    .eq("funnel_id", funnelId)
    .eq("slug", stepSlug)
    .maybeSingle();

  const isCta = String((step as any)?.step_type ?? "") === "cta";
  const ctaStep =
    isCta
      ? step
      : (
          await admin
            .from("funnel_steps" as never)
            .select("id,slug,step_type,metadata")
            .eq("funnel_id", funnelId)
            .eq("step_type", "cta")
            .order("step_index", { ascending: true })
            .limit(1)
            .maybeSingle()
        ).data;

  const meta = (((ctaStep as any)?.metadata ?? {}) as Record<string, unknown>) ?? {};
  const cta = (meta.cta ?? {}) as Record<string, unknown>;
  const clickUrl = typeof cta.click_url === "string" ? cta.click_url : null;
  const destination = clickUrl ?? (typeof cta.destination_url === "string" ? cta.destination_url : "/");

  // Log CTA click
  await admin.from("analytics_events" as never).insert({
    organization_id: (camp as any)?.organization_id ?? null,
    campaign_id: campaignId,
    funnel_id: funnelId,
    event_name: "cta_click",
    source: "public.funnel.redirect",
    metadata: { funnel_step_id: (ctaStep as any)?.id ?? null, destination },
  } as never);

  // If clickUrl points at our affiliate click API, redirect there (it logs affiliate_click too).
  return NextResponse.redirect(new URL(destination, request.url));
}

