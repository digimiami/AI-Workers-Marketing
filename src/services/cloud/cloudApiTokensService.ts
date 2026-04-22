import { createHash, randomBytes, timingSafeEqual } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { assertOrgOperator } from "@/services/org/assertOrgAccess";

const TOKEN_PREFIX = "aiw_";

export function hashCloudApiTokenSecret(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export function generateCloudApiTokenPlain(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function cloudTokenDisplayPrefix(plain: string): string {
  const slice = plain.slice(0, 14);
  return slice.length < plain.length ? `${slice}…` : slice;
}

function safeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyLegacyOpenClawApiKey(plain: string | undefined): boolean {
  if (!plain) return false;
  const expected = env.server.OPENCLAW_API_KEY;
  if (!expected || expected.length < 10) return false;
  return safeEqualString(plain, expected);
}

export type ResolvedCloudApiToken = {
  id: string;
  organization_id: string;
  actor_user_id: string;
};

export async function resolveCloudApiTokenBySecret(
  admin: SupabaseClient,
  plainSecret: string,
): Promise<ResolvedCloudApiToken | null> {
  const token_hash = hashCloudApiTokenSecret(plainSecret);
  const { data, error } = await admin
    .from("organization_cloud_api_tokens" as never)
    .select("id, organization_id, actor_user_id, revoked_at, expires_at")
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as {
    id: string;
    organization_id: string;
    actor_user_id: string;
    revoked_at: string | null;
    expires_at: string | null;
  };
  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return null;
  return {
    id: row.id,
    organization_id: row.organization_id,
    actor_user_id: row.actor_user_id,
  };
}

export async function touchCloudApiTokenUsed(admin: SupabaseClient, tokenId: string) {
  await admin
    .from("organization_cloud_api_tokens" as never)
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq("id", tokenId);
}

export async function listCloudApiTokens(admin: SupabaseClient, organizationId: string) {
  const { data, error } = await admin
    .from("organization_cloud_api_tokens" as never)
    .select("id, name, token_prefix, actor_user_id, created_at, revoked_at, last_used_at, expires_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    name: string;
    token_prefix: string;
    actor_user_id: string;
    created_at: string;
    revoked_at: string | null;
    last_used_at: string | null;
    expires_at: string | null;
  }>;
}

export type CreateCloudApiTokenResult = {
  id: string;
  plain_token: string;
  token_prefix: string;
};

export async function createCloudApiToken(params: {
  admin: SupabaseClient;
  organizationId: string;
  createdByUserId: string;
  actorUserId: string;
  name?: string;
}): Promise<CreateCloudApiTokenResult> {
  await assertOrgOperator(params.admin, params.createdByUserId, params.organizationId);
  await assertOrgOperator(params.admin, params.actorUserId, params.organizationId);

  const plain_token = generateCloudApiTokenPlain();
  const token_hash = hashCloudApiTokenSecret(plain_token);
  const token_prefix = cloudTokenDisplayPrefix(plain_token);

  const { data, error } = await params.admin
    .from("organization_cloud_api_tokens" as never)
    .insert({
      organization_id: params.organizationId,
      name: params.name?.trim() || "Cloud API",
      token_hash,
      token_prefix,
      actor_user_id: params.actorUserId,
      created_by_user_id: params.createdByUserId,
    } as never)
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create token");
  return { id: (data as { id: string }).id, plain_token, token_prefix };
}

export async function revokeCloudApiToken(params: {
  admin: SupabaseClient;
  organizationId: string;
  tokenId: string;
  actorUserId: string;
}) {
  await assertOrgOperator(params.admin, params.actorUserId, params.organizationId);
  const { error } = await params.admin
    .from("organization_cloud_api_tokens" as never)
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("id", params.tokenId)
    .eq("organization_id", params.organizationId);
  if (error) throw new Error(error.message);
}
