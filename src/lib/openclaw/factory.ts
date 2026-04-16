import { getDefaultFeatureFlags } from "@/lib/featureFlags";
import { createOpenClawHttpProviderFromEnv } from "@/lib/openclaw/http-provider";
import { OpenClawStubProvider } from "@/lib/openclaw/stub-provider";
import type { OpenClawProvider, OpenClawProviderId } from "@/lib/openclaw/types";

/**
 * Central factory: picks HTTP provider when configured + enabled, otherwise stub.
 * Swap implementations here when adding multi-backend routing (e.g. regional endpoints).
 */
export function getOpenClawProvider(): OpenClawProvider {
  const flags = getDefaultFeatureFlags();
  if (!flags.enable_openclaw) {
    return new OpenClawStubProvider();
  }
  const http = createOpenClawHttpProviderFromEnv();
  if (http) return http;
  return new OpenClawStubProvider();
}

export function describeOpenClawBackend(): {
  active: OpenClawProviderId;
  httpConfigured: boolean;
} {
  const http = createOpenClawHttpProviderFromEnv();
  if (http) return { active: "http", httpConfigured: true };
  return { active: "stub", httpConfigured: false };
}
