import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type PublishFunnelInput = {
  organizationId: string;
  campaign_id: string;
  funnel_id?: string | null;
  variant_id?: string | null;
  activate_campaign?: boolean;
};

export type PublishFunnelResult = {
  ok: true;
  funnel_id: string;
  campaign_id: string;
  steps_made_public: number;
  public_urls: string[];
  variant_id: string | null;
};

export async function executePublishFunnel(
  admin: AdminClient,
  input: PublishFunnelInput,
): Promise<PublishFunnelResult> {
  const now = new Date().toISOString();
  let funnelId = input.funnel_id ?? null;
  if (!funnelId) {
    const { data: camp } = await admin
      .from("campaigns" as never)
      .select("funnel_id")
      .eq("organization_id", input.organizationId)
      .eq("id", input.campaign_id)
      .maybeSingle();
    funnelId = (camp as { funnel_id?: string | null } | null)?.funnel_id
      ? String((camp as { funnel_id: string }).funnel_id)
      : null;
  }
  if (!funnelId) {
    const { data: funnel } = await admin
      .from("funnels" as never)
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("campaign_id", input.campaign_id)
      .maybeSingle();
    funnelId = funnel ? String((funnel as { id: string }).id) : null;
  }
  if (!funnelId) throw new Error("FUNNEL_NOT_FOUND");

  if (input.variant_id) {
    await admin
      .from("landing_page_variants" as never)
      .update({ selected: false, updated_at: now } as never)
      .eq("organization_id", input.organizationId)
      .eq("campaign_id", input.campaign_id);
    const { data: variant } = await admin
      .from("landing_page_variants" as never)
      .update({ selected: true, status: "published", updated_at: now } as never)
      .eq("organization_id", input.organizationId)
      .eq("campaign_id", input.campaign_id)
      .eq("id", input.variant_id)
      .select("id,variant_key,funnel_step_id")
      .maybeSingle();
    if (!variant) throw new Error("VARIANT_NOT_FOUND");
    const funnelStepId = (variant as { funnel_step_id?: string | null }).funnel_step_id
      ? String((variant as { funnel_step_id: string }).funnel_step_id)
      : null;
    const variantKey = String((variant as { variant_key?: string }).variant_key ?? "");
    if (funnelStepId && variantKey) {
      const { data: step } = await admin
        .from("funnel_steps" as never)
        .select("metadata")
        .eq("organization_id", input.organizationId)
        .eq("id", funnelStepId)
        .maybeSingle();
      const prev = asMetadataRecord((step as { metadata?: unknown } | null)?.metadata);
      const next = mergeJsonbRecords(prev, { page: { kind: "structured", variant_key: variantKey } });
      await admin
        .from("funnel_steps" as never)
        .update({ metadata: next, updated_at: now } as never)
        .eq("organization_id", input.organizationId)
        .eq("id", funnelStepId);
    }
  }

  const { data: steps, error: stepsErr } = await admin
    .from("funnel_steps" as never)
    .select("id,slug,step_type")
    .eq("organization_id", input.organizationId)
    .eq("funnel_id", funnelId);
  if (stepsErr) throw new Error(stepsErr.message);

  await admin
    .from("funnel_steps" as never)
    .update({ is_public: true, updated_at: now } as never)
    .eq("organization_id", input.organizationId)
    .eq("funnel_id", funnelId);

  await admin
    .from("funnels" as never)
    .update({ status: "active", updated_at: now } as never)
    .eq("organization_id", input.organizationId)
    .eq("id", funnelId);

  if (input.activate_campaign !== false) {
    await admin
      .from("campaigns" as never)
      .update({ status: "active", funnel_id: funnelId, updated_at: now } as never)
      .eq("organization_id", input.organizationId)
      .eq("id", input.campaign_id);
  }

  const publicUrls = ((steps ?? []) as Array<{ slug?: string }>)
    .map((s) => (s.slug ? `/f/${input.campaign_id}/${String(s.slug)}` : null))
    .filter((u): u is string => Boolean(u));

  return {
    ok: true,
    funnel_id: funnelId,
    campaign_id: input.campaign_id,
    steps_made_public: (steps ?? []).length,
    public_urls: publicUrls,
    variant_id: input.variant_id ?? null,
  };
}
