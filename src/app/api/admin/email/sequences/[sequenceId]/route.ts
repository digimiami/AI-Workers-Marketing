import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const patchBody = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

const deleteBody = z.object({
  organizationId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ sequenceId: string }> },
) {
  const { sequenceId } = await ctx.params;
  if (!z.string().uuid().safeParse(sequenceId).success) {
    return NextResponse.json({ ok: false, message: "Invalid sequenceId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active;

  const { data, error } = await op.supabase
    .from("email_sequences" as never)
    .update(patch as never)
    .eq("id", sequenceId)
    .eq("organization_id", parsed.data.organizationId)
    .select("id,name,description,is_active,created_at,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: "Sequence not found" }, { status: 404 });
  return NextResponse.json({ ok: true, sequence: data });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ sequenceId: string }> },
) {
  const { sequenceId } = await ctx.params;
  if (!z.string().uuid().safeParse(sequenceId).success) {
    return NextResponse.json({ ok: false, message: "Invalid sequenceId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const stepsDelete = await op.supabase
    .from("email_sequence_steps" as never)
    .delete()
    .eq("sequence_id", sequenceId)
    .eq("organization_id", parsed.data.organizationId);

  if (stepsDelete.error) {
    return NextResponse.json({ ok: false, message: stepsDelete.error.message }, { status: 500 });
  }

  const { error } = await op.supabase
    .from("email_sequences" as never)
    .delete()
    .eq("id", sequenceId)
    .eq("organization_id", parsed.data.organizationId);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
