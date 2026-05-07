import crypto from "crypto";

import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrgEntitlements } from "@/services/billing/entitlements";

export function hashPrompt(input: { system: string; user: string; model?: string | null }) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ system: input.system, user: input.user, model: input.model ?? null }))
    .digest("hex");
}

export async function getCachedAiJson(input: {
  organizationId?: string | null;
  promptHash: string;
}) {
  if (!input.organizationId) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("ai_cache" as never)
    .select("output,expires_at")
    .eq("organization_id", input.organizationId)
    .eq("prompt_hash", input.promptHash)
    .maybeSingle();
  if (!data) return null;
  const expires = (data as any).expires_at ? new Date(String((data as any).expires_at)).getTime() : null;
  if (expires && expires < Date.now()) return null;
  const output = (data as any).output;
  return output && typeof output === "object" ? JSON.stringify(output) : null;
}

export async function setCachedAiJson(input: {
  organizationId?: string | null;
  promptHash: string;
  provider: string;
  model?: string | null;
  request: Record<string, unknown>;
  jsonText: string;
  ttlHours?: number;
}) {
  if (!input.organizationId) return;
  let output: unknown;
  try {
    output = JSON.parse(input.jsonText);
  } catch {
    return;
  }
  const admin = createSupabaseAdminClient();
  await admin.from("ai_cache" as never).upsert(
    {
      organization_id: input.organizationId,
      prompt_hash: input.promptHash,
      provider: input.provider,
      model: input.model ?? null,
      input: input.request,
      output,
      expires_at: new Date(Date.now() + (input.ttlHours ?? 24) * 3600_000).toISOString(),
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "organization_id,prompt_hash" },
  );
}

export async function assertAiUsageAllowed(input: {
  organizationId?: string | null;
  userId?: string | null;
}) {
  if (!input.organizationId) return;
  const ent = await getOrgEntitlements(input.organizationId);
  const admin = createSupabaseAdminClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  let q = admin
    .from("ai_usage" as never)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("cache_hit", false)
    .gte("created_at", monthStart.toISOString());
  if (input.userId) q = q.eq("user_id", input.userId);
  const { count, error } = await q;
  if (error) return;
  if ((count ?? 0) >= ent.maxAiGenerationsPerMonth) {
    throw new AppError(
      "AI_USAGE_LIMIT",
      `AI generation limit reached for ${ent.plan}. Upgrade or wait for the next billing cycle.`,
      402,
      { plan: ent.plan, limit: ent.maxAiGenerationsPerMonth },
    );
  }
}

export async function recordAiUsage(input: {
  organizationId?: string | null;
  userId?: string | null;
  promptHash?: string | null;
  provider: string;
  model?: string | null;
  cacheHit?: boolean;
  metadata?: Record<string, unknown>;
}) {
  if (!input.organizationId) return;
  try {
    const ent = await getOrgEntitlements(input.organizationId);
    const admin = createSupabaseAdminClient();
    await admin.from("ai_usage" as never).insert({
      organization_id: input.organizationId,
      user_id: input.userId ?? null,
      plan: ent.plan,
      provider: input.provider,
      model: input.model ?? null,
      cache_hit: Boolean(input.cacheHit),
      prompt_hash: input.promptHash ?? null,
      metadata: input.metadata ?? {},
      created_at: new Date().toISOString(),
    } as never);
  } catch {
    // Usage tracking must not break fallback AI generation.
  }
}

