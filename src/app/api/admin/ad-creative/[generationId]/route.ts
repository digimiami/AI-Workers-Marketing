import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const deleteBody = z.object({
  organizationId: z.string().uuid(),
});

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ generationId: string }> },
) {
  const { generationId } = await ctx.params;
  if (!z.string().uuid().safeParse(generationId).success) {
    return NextResponse.json({ ok: false, message: "Invalid generationId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const { error } = await op.supabase
    .from("ad_creative_generations" as never)
    .delete()
    .eq("id", generationId)
    .eq("organization_id", parsed.data.organizationId);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
