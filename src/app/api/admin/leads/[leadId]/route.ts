import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const patchBody = z.object({
  organizationId: z.string().uuid(),
  status: z.string().min(1).optional(),
  score: z.number().int().min(0).max(100).optional(),
  full_name: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await ctx.params;
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ ok: false, message: "Invalid leadId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.score !== undefined) patch.score = parsed.data.score;
  if (parsed.data.full_name !== undefined) patch.full_name = parsed.data.full_name;

  const { data, error } = await op.supabase
    .from("leads" as never)
    .update(patch as never)
    .eq("id", leadId)
    .eq("organization_id", parsed.data.organizationId)
    .select("id,email,full_name,status,score,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: "Lead not found" }, { status: 404 });
  return NextResponse.json({ ok: true, lead: data });
}
