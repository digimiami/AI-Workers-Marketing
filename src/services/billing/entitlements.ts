import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export type PlanKey = "free" | "starter" | "pro" | "agency";

export type Entitlements = {
  plan: PlanKey;
  canLaunchAds: boolean;
  maxCampaigns: number;
  maxAiGenerationsPerMonth: number;
};

const PLAN: Record<PlanKey, Entitlements> = {
  free: { plan: "free", canLaunchAds: false, maxCampaigns: 1, maxAiGenerationsPerMonth: 20 },
  starter: { plan: "starter", canLaunchAds: false, maxCampaigns: 3, maxAiGenerationsPerMonth: 150 },
  pro: { plan: "pro", canLaunchAds: true, maxCampaigns: 999999, maxAiGenerationsPerMonth: 5000 },
  agency: { plan: "agency", canLaunchAds: true, maxCampaigns: 999999, maxAiGenerationsPerMonth: 20000 },
};

function stripeBillingDisabled() {
  const v = (env.server.BILLING_DISABLE_STRIPE ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function getOrgEntitlements(organizationId: string): Promise<Entitlements> {
  if (stripeBillingDisabled()) {
    // When Stripe subs are disabled, treat orgs as Pro so the product isn't blocked by paywalls.
    return PLAN.pro;
  }
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("organization_subscriptions" as never)
    .select("plan,subscription_status,current_period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const plan = (data as any)?.plan as PlanKey | undefined;
  const status = String((data as any)?.subscription_status ?? "inactive");
  const isPaidActive = (status === "active" || status === "trialing") && Boolean(plan) && plan !== "free";
  if (!isPaidActive) return PLAN.free;
  return PLAN[plan ?? "free"] ?? PLAN.free;
}

export async function assertCampaignLimit(params: { organizationId: string }) {
  const ent = await getOrgEntitlements(params.organizationId);
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("campaigns" as never)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", params.organizationId);
  if (error) throw new Error(error.message);
  if ((count ?? 0) >= ent.maxCampaigns) {
    throw new Error(`PLAN_LIMIT_CAMPAIGNS:${ent.plan}`);
  }
}

export async function assertAdsLaunchAllowed(params: { organizationId: string }) {
  const ent = await getOrgEntitlements(params.organizationId);
  if (!ent.canLaunchAds) {
    throw new Error(`PLAN_BLOCK_AD_LAUNCH:${ent.plan}`);
  }
}

