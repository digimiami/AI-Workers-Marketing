import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const patchBody = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  body_markdown: z.string().min(1).optional(),
});

const deleteBody = z.object({
  organizationId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await ctx.params;
  if (!z.string().uuid().safeParse(templateId).success) {
    return NextResponse.json({ ok: false, message: "Invalid templateId" }, { status: 400 });
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
  if (parsed.data.subject !== undefined) patch.subject = parsed.data.subject;
  if (parsed.data.body_markdown !== undefined) patch.body_markdown = parsed.data.body_markdown;

  const { data, error } = await op.supabase
    .from("email_templates" as never)
    .update(patch as never)
    .eq("id", templateId)
    .eq("organization_id", parsed.data.organizationId)
    .select("id,name,subject,body_markdown,created_at,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: "Template not found" }, { status: 404 });
  return NextResponse.json({ ok: true, template: data });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await ctx.params;
  if (!z.string().uuid().safeParse(templateId).success) {
    return NextResponse.json({ ok: false, message: "Invalid templateId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const { error } = await op.supabase
    .from("email_templates" as never)
    .delete()
    .eq("id", templateId)
    .eq("organization_id", parsed.data.organizationId);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

