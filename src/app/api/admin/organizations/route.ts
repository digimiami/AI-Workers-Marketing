import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/services/auth/authService";

/**
 * List organizations the current user belongs to (for workspace launcher org picker).
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("organization_members" as never)
    .select("organization_id, role, organizations(id,name,slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const orgs = (data ?? []).map((row: any) => ({
    id: row.organizations?.id ?? row.organization_id,
    name: row.organizations?.name ?? "—",
    slug: row.organizations?.slug ?? "",
    role: row.role,
  }));

  return NextResponse.json({ ok: true, organizations: orgs });
}
