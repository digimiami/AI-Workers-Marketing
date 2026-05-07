import { env } from "@/lib/env";
import { asMetadataRecord } from "@/lib/mergeJsonbRecords";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FeatureFlagKey =
  | "enable_openclaw"
  | "enable_chatbot"
  | "enable_email_automation"
  | "enable_affiliate_tracking"
  | "enable_public_demo"
  | "require_approval_before_publish"
  | "require_approval_before_email"
  | "enable_analytics_dashboard";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

/**
 * Centralized feature flags.
 *
 * Production uses DB-backed overrides (Settings table) later; for now we read
 * environment defaults and provide an easy single place to switch behavior.
 */
export function getDefaultFeatureFlags(): FeatureFlags {
  const isProd = env.server.NODE_ENV === "production";

  return {
    enable_openclaw: true,
    enable_chatbot: true,
    enable_email_automation: true,
    enable_affiliate_tracking: true,
    enable_public_demo: true,
    require_approval_before_publish: isProd,
    require_approval_before_email: isProd,
    enable_analytics_dashboard: true,
  };
}

export type RuntimeFeatureFlagKey =
  | "AUTO_MODE_ENABLED"
  | "ADS_LIVE_MODE"
  | "ADVANCED_OPTIMIZATION"
  | "REFERRALS_ENABLED"
  | "AFFILIATES_ENABLED";

function envRuntimeFlag(key: RuntimeFeatureFlagKey): boolean | null {
  if (key === "ADS_LIVE_MODE") return (env.server.ADS_PROVIDER_MODE ?? "stub") === "live";
  // eslint-disable-next-line no-process-env
  const raw = process.env[key];
  if (raw == null) return null;
  return ["1", "true", "on", "yes"].includes(String(raw).toLowerCase());
}

export async function isFeatureEnabled(key: RuntimeFeatureFlagKey, organizationId?: string | null) {
  const fromEnv = envRuntimeFlag(key);
  if (fromEnv != null) return fromEnv;

  if (!organizationId) return key !== "ADS_LIVE_MODE";

  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("settings" as never)
      .select("value")
      .eq("organization_id", organizationId)
      .eq("key", "feature_flags")
      .maybeSingle();
    const flags = asMetadataRecord((data as { value?: unknown } | null)?.value);
    if (typeof flags[key] === "boolean") return Boolean(flags[key]);
  } catch {
    // Fail closed for risky features, open for non-risky defaults.
  }

  if (key === "ADS_LIVE_MODE") return false;
  if (key === "ADVANCED_OPTIMIZATION") return false;
  return true;
}

