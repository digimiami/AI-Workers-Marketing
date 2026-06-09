import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgRole = "admin" | "operator" | "viewer" | "client";

export async function getOrgRole(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<OrgRole | null> {
  const { data, error } = await supabase
    .from("organization_members" as never)
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { role: OrgRole }).role;
}

function isOperatorRole(role: OrgRole | null): boolean {
  return role === "admin" || role === "operator";
}

/** Check operator access for an explicit user (works with admin + user clients). */
export async function isOrgOperatorForUser(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const role = await getOrgRole(supabase, userId, organizationId);
  return isOperatorRole(role);
}

/** Check whether the current auth session is an org operator (user-scoped client only). */
export async function isOrgOperator(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_org_operator" as never, { org_id: organizationId } as never);
  if (!error && typeof data === "boolean") return data;
  // Fallback when RPC is unavailable — read own membership row under RLS.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return isOrgOperatorForUser(supabase, user.id, organizationId);
}

export async function assertOrgMember(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<void> {
  const role = await getOrgRole(supabase, userId, organizationId);
  if (!role) {
    throw new Error("FORBIDDEN_ORG");
  }
}

export async function assertOrgOperator(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<void> {
  const allowed = await isOrgOperatorForUser(supabase, userId, organizationId);
  if (!allowed) {
    throw new Error("FORBIDDEN_OPERATOR");
  }
}

export async function assertOrgAdmin(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<void> {
  const role = await getOrgRole(supabase, userId, organizationId);
  if (role !== "admin") {
    throw new Error("FORBIDDEN_ADMIN");
  }
}
