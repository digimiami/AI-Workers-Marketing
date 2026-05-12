import { NextResponse } from "next/server";

import { z } from "zod";

import { clearCurrentOrgIdCookie, getCurrentOrgIdFromCookie, setCurrentOrgIdCookie } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/services/auth/authService";
import { writeAuditLog } from "@/services/audit/auditService";
import { assertOrgAdmin, assertOrgOperator } from "@/services/org/assertOrgAccess";

const patchBody = z.object({
  name: z.string().min(2).max(80).optional(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes.")
    .optional(),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await ctx.params;
  if (!z.string().uuid().safeParse(organizationId).success) {
    return NextResponse.json({ ok: false, message: "Invalid organizationId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", issues: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.name === undefined && parsed.data.slug === undefined) {
    return NextResponse.json({ ok: false, message: "Provide name and/or slug" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertOrgOperator(supabase, user.id, organizationId);
  } catch {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.slug !== undefined) patch.slug = parsed.data.slug;

  const { data, error } = await admin
    .from("organizations" as never)
    .update(patch as never)
    .eq("id", organizationId)
    .select("id,name,slug,created_at,updated_at")
    .maybeSingle();

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ ok: false, message: "Slug is already taken" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ ok: false, message: "Organization not found" }, { status: 404 });

  await writeAuditLog({
    organizationId,
    actorUserId: user.id,
    action: "org.updated",
    entityType: "organization",
    entityId: organizationId,
    metadata: { fields: Object.keys(patch).filter((k) => k !== "updated_at") },
  });

  return NextResponse.json({ ok: true, organization: data });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await ctx.params;
  if (!z.string().uuid().safeParse(organizationId).success) {
    return NextResponse.json({ ok: false, message: "Invalid organizationId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertOrgAdmin(supabase, user.id, organizationId);
  } catch {
    return NextResponse.json({ ok: false, message: "Only organization admins can delete a workspace." }, { status: 403 });
  }

  const { data: memberships, error: listErr } = await supabase
    .from("organization_members" as never)
    .select("organization_id")
    .eq("user_id", user.id);
  if (listErr) return NextResponse.json({ ok: false, message: listErr.message }, { status: 500 });
  if ((memberships ?? []).length < 2) {
    return NextResponse.json(
      { ok: false, message: "You cannot delete your only organization. Create or join another workspace first." },
      { status: 409 },
    );
  }

  const admin = createSupabaseAdminClient();
  const currentCookieOrg = await getCurrentOrgIdFromCookie();

  await writeAuditLog({
    organizationId,
    actorUserId: user.id,
    action: "org.deleted",
    entityType: "organization",
    entityId: organizationId,
    metadata: {},
  });

  const { error: delErr } = await admin.from("organizations" as never).delete().eq("id", organizationId);
  if (delErr) return NextResponse.json({ ok: false, message: delErr.message }, { status: 500 });

  let nextOrgId: string | null = null;
  if (currentCookieOrg === organizationId) {
    const { data: remaining } = await admin
      .from("organization_members" as never)
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    nextOrgId = (remaining as { organization_id?: string } | null)?.organization_id ?? null;
    if (nextOrgId) {
      await setCurrentOrgIdCookie(nextOrgId);
    } else {
      await clearCurrentOrgIdCookie();
    }
  }

  return NextResponse.json({
    ok: true,
    switchedOrganizationId: currentCookieOrg === organizationId ? nextOrgId : null,
  });
}
