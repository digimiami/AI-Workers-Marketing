import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { enrollLeadInSequence } from "@/services/email/enrollmentService";

const createBody = z.object({
  organizationId: z.string().uuid(),
  leadId: z.string().uuid(),
  sequenceId: z.string().uuid(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const leadId = url.searchParams.get("leadId");
  const parsedOrg = z.string().uuid().safeParse(organizationId);
  if (!parsedOrg.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsedOrg.data);
  if (ctx.error) return ctx.error;

  let q = ctx.supabase
    .from("email_enrollments" as never)
    .select("id,lead_id,sequence_id,status,enrolled_at,email_sequences(name)")
    .eq("organization_id", parsedOrg.data)
    .order("enrolled_at", { ascending: false })
    .limit(200);

  if (leadId && z.string().uuid().safeParse(leadId).success) {
    q = q.eq("lead_id", leadId);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, enrollments: data ?? [] });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  try {
    const res = await enrollLeadInSequence(ctx.supabase, {
      organizationId: parsed.data.organizationId,
      actorUserId: ctx.user.id,
      leadId: parsed.data.leadId,
      sequenceId: parsed.data.sequenceId,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to enroll lead";
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}

