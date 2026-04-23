import { NextResponse } from "next/server";

import { z } from "zod";

import { setCurrentOrgIdCookie } from "@/lib/cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/services/auth/authService";
import { assertOrgMember } from "@/services/org/assertOrgAccess";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertOrgMember(supabase, user.id, parsed.data.organizationId);
  } catch {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  await setCurrentOrgIdCookie(parsed.data.organizationId);
  return NextResponse.json({ ok: true, organizationId: parsed.data.organizationId });
}

