import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateLandingVariants } from "@/services/growth/landingVariantsService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  url: z.string().url(),
  goal: z.string().min(2),
  audience: z.string().min(2),
  trafficSource: z.string().min(2),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const pack = await generateLandingVariants({
    url: parsed.data.url,
    goal: parsed.data.goal,
    audience: parsed.data.audience,
    trafficSource: parsed.data.trafficSource,
    baseLanding: null,
  });

  const variants = Array.isArray((pack as { variants?: unknown }).variants)
    ? ((pack as { variants: unknown[] }).variants as Record<string, unknown>[])
    : [];

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  for (const v of variants) {
    const key =
      typeof v.variantKey === "string"
        ? v.variantKey
        : typeof (v as { key?: string }).key === "string"
          ? String((v as { key?: string }).key)
          : "";
    if (!key) continue;
    const angle = typeof v.angle === "string" ? v.angle : key;
    const content = {
      headline: typeof v.headline === "string" ? v.headline : "",
      subheadline: typeof v.subheadline === "string" ? v.subheadline : "",
      ctaText: typeof v.ctaText === "string" ? v.ctaText : typeof v.cta === "string" ? String(v.cta) : "",
      benefits: Array.isArray(v.benefits) ? v.benefits : [],
      steps: Array.isArray(v.steps) ? v.steps : [],
      trustLine: typeof v.trustLine === "string" ? v.trustLine : "",
      finalCTA: (v as { finalCTA?: unknown }).finalCTA ?? {},
      psychologicalTrigger: typeof (v as { psychologicalTrigger?: string }).psychologicalTrigger === "string"
        ? String((v as { psychologicalTrigger?: string }).psychologicalTrigger)
        : "",
      variantLabel: typeof (v as { variantLabel?: string }).variantLabel === "string" ? String((v as { variantLabel?: string }).variantLabel) : "",
      regenerated_at: now,
    };

    const { error } = await admin
      .from("landing_page_variants" as never)
      .update({ angle, content: content as never, updated_at: now, status: "draft" } as never)
      .eq("organization_id", parsed.data.organizationId)
      .eq("campaign_id", parsed.data.campaignId)
      .eq("variant_key", key);
    if (error) {
      return NextResponse.json({ ok: false, message: error.message, variantKey: key }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, landingVariants: pack });
}
