import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/services/auth/authService";
import { assertOrgMember, assertOrgOperator } from "@/services/org/assertOrgAccess";

export async function requireAuth() {
  const { user, error } = await getAuthedUser();
  if (error || !user) {
    return { user: null, supabase: null, error: NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 }) };
  }
  const supabase = await createSupabaseServerClient();
  return { user, supabase, error: null as null };
}

export async function requireOrganization(organizationId: string, role: "member" | "operator" = "member") {
  const auth = await requireAuth();
  if (auth.error) return auth;
  try {
    if (role === "operator") await assertOrgOperator(auth.supabase!, auth.user!.id, organizationId);
    else await assertOrgMember(auth.supabase!, auth.user!.id, organizationId);
  } catch {
    return { user: auth.user, supabase: auth.supabase, error: NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}

