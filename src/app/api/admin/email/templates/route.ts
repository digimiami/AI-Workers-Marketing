import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const createBody = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
  subject: z.string().min(1),
  body_markdown: z.string().min(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsed = z.string().uuid().safeParse(organizationId);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data);
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.supabase
    .from("email_templates" as never)
    .select("id,name,subject,body_markdown,created_at,updated_at")
    .eq("organization_id", parsed.data)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, templates: data ?? [] });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.supabase
    .from("email_templates" as never)
    .insert({
      organization_id: parsed.data.organizationId,
      name: parsed.data.name,
      subject: parsed.data.subject,
      body_markdown: parsed.data.body_markdown,
    } as never)
    .select("id,name,subject,body_markdown,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, template: data });
}

