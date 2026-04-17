import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";

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
    .from("leads" as never)
    .select("id,email,phone,full_name,status,score,campaign_id,source_page,created_at,updated_at,campaigns(name)")
    .eq("organization_id", parsed.data)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, leads: data ?? [] });
}
