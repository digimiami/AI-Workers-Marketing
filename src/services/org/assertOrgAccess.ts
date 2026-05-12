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
  const role = await getOrgRole(supabase, userId, organizationId);
  if (!role || (role !== "admin" && role !== "operator")) {
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
