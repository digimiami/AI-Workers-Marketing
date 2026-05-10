import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const patchBody = z.object({
  organizationId: z.string().uuid(),
  report_markdown: z.string().nullable().optional(),
  status: z.enum(["draft", "generated", "sent", "failed"]).optional(),
});

const deleteBody = z.object({
  organizationId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await ctx.params;
  if (!z.string().uuid().safeParse(reportId).success) {
    return NextResponse.json({ ok: false, message: "Invalid reportId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.report_markdown !== undefined) patch.report_markdown = parsed.data.report_markdown;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;

  const { data, error } = await op.supabase
    .from("weekly_reports" as never)
    .update(patch as never)
    .eq("id", reportId)
    .eq("organization_id", parsed.data.organizationId)
    .select("id,status,report_markdown,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: "Report not found" }, { status: 404 });
  return NextResponse.json({ ok: true, report: data });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await ctx.params;
  if (!z.string().uuid().safeParse(reportId).success) {
    return NextResponse.json({ ok: false, message: "Invalid reportId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const { error } = await op.supabase
    .from("weekly_reports" as never)
    .delete()
    .eq("id", reportId)
    .eq("organization_id", parsed.data.organizationId);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
