import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const patchBody = z.object({
  organizationId: z.string().uuid(),
  delay_minutes: z.number().int().min(0).optional(),
  template_id: z.string().uuid().nullable().optional(),
});

const deleteBody = z.object({
  organizationId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ stepId: string }> },
) {
  const { stepId } = await ctx.params;
  if (!z.string().uuid().safeParse(stepId).success) {
    return NextResponse.json({ ok: false, message: "Invalid stepId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.delay_minutes !== undefined) patch.delay_minutes = parsed.data.delay_minutes;
  if (parsed.data.template_id !== undefined) patch.template_id = parsed.data.template_id;

  const { data, error } = await op.supabase
    .from("email_sequence_steps" as never)
    .update(patch as never)
    .eq("id", stepId)
    .eq("organization_id", parsed.data.organizationId)
    .select("id,sequence_id,step_index,delay_minutes,template_id,created_at,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: "Step not found" }, { status: 404 });
  return NextResponse.json({ ok: true, step: data });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ stepId: string }> },
) {
  const { stepId } = await ctx.params;
  if (!z.string().uuid().safeParse(stepId).success) {
    return NextResponse.json({ ok: false, message: "Invalid stepId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const { error } = await op.supabase
    .from("email_sequence_steps" as never)
    .delete()
    .eq("id", stepId)
    .eq("organization_id", parsed.data.organizationId);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

