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

/** Uses SECURITY DEFINER RPC — reliable under RLS for API routes and server actions. */
export async function isOrgOperator(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_org_operator" as never, { org_id: organizationId } as never);
  if (error) return false;
  return Boolean(data);
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
  _userId: string,
  organizationId: string,
): Promise<void> {
  const allowed = await isOrgOperator(supabase, organizationId);
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
