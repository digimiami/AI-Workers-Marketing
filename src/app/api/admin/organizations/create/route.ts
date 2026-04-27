import { NextResponse } from "next/server";

import { z } from "zod";

import { setCurrentOrgIdCookie } from "@/lib/cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/services/auth/authService";
import { writeAuditLog } from "@/services/audit/auditService";

const bodySchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes."),
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

  const { data: org, error } = await supabase.rpc("create_organization_with_owner" as any, {
    org_name: parsed.data.name,
    org_slug: parsed.data.slug,
  } as any);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!org) return NextResponse.json({ ok: false, message: "Failed to create organization" }, { status: 500 });

  await setCurrentOrgIdCookie((org as any).id);

  await writeAuditLog({
    organizationId: (org as any).id,
    actorUserId: user.id,
    action: "org.created",
    entityType: "organization",
    entityId: (org as any).id,
    metadata: { name: parsed.data.name, slug: parsed.data.slug },
  });

  return NextResponse.json({ ok: true, organization: org });
}

