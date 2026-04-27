import { NextResponse } from "next/server";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/services/auth/authService";
import { writeAuditLog } from "@/services/audit/auditService";
import { assertOrgOperator } from "@/services/org/assertOrgAccess";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["operator", "viewer", "client"]).default("viewer"),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertOrgOperator(supabase, user.id, parsed.data.organizationId);
  } catch {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();

  // Invite user (creates user if missing) and returns user id.
  const inviteRes = await (admin as any).auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { invited_to_org_id: parsed.data.organizationId },
  });
  if ((inviteRes as any)?.error) {
    return NextResponse.json({ ok: false, message: String((inviteRes as any).error?.message ?? "Invite failed") }, { status: 500 });
  }

  const invitedUserId = String((inviteRes as any)?.data?.user?.id ?? "");
  if (!invitedUserId) {
    return NextResponse.json({ ok: false, message: "Invite succeeded but user id missing" }, { status: 500 });
  }

  const { error: memberErr } = await admin
    .from("organization_members" as never)
    .upsert(
      {
        organization_id: parsed.data.organizationId,
        user_id: invitedUserId,
        role: parsed.data.role,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "organization_id,user_id" },
    );
  if (memberErr) return NextResponse.json({ ok: false, message: memberErr.message }, { status: 500 });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: user.id,
    action: "org.member_invited",
    entityType: "organization_member",
    entityId: invitedUserId,
    metadata: { email: parsed.data.email, role: parsed.data.role },
  });

  return NextResponse.json({ ok: true, user_id: invitedUserId, role: parsed.data.role });
}

