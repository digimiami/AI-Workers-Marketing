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
    .from("chat_conversations" as never)
    .select("id,status,lead_id,lead_score,started_at,last_message_at,campaign_id")
    .eq("organization_id", parsed.data)
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, conversations: (data ?? []) as any[] });
}

