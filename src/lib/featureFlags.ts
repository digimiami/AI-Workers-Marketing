import { env } from "@/lib/env";

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

