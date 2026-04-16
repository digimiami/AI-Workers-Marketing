import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export async function listMyOrganizations(): Promise<Organization[]> {
  const supabase = await createSupabaseServerClient();
  // Join via organization_members; RLS enforces membership.
  const { data, error } = await supabase
    .from("organization_members" as any)
    .select("organization:organizations(id,name,slug)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const orgs = (data ?? [])
    .map((row: any) => row.organization)
    .filter(Boolean) as Organization[];

  // De-dupe
  const unique = new Map<string, Organization>();
  orgs.forEach((o) => unique.set(o.id, o));
  return Array.from(unique.values());
}

