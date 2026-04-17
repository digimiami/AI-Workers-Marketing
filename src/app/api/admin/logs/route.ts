import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";

const limitSchema = z.coerce.number().int().min(1).max(100);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsedOrg = z.string().uuid().safeParse(organizationId);
  if (!parsedOrg.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const lim = limitSchema.safeParse(url.searchParams.get("limit") ?? "40");
  const take = lim.success ? lim.data : 40;

  const ctx = await withOrgMember(parsedOrg.data);
  if (ctx.error) return ctx.error;

  const [audit, agent, email] = await Promise.all([
    ctx.supabase
      .from("audit_logs" as never)
      .select("id,action,entity_type,entity_id,metadata,created_at,actor_user_id")
      .eq("organization_id", parsedOrg.data)
      .order("created_at", { ascending: false })
      .limit(take),
    ctx.supabase
      .from("agent_logs" as never)
      .select("id,run_id,level,message,data,created_at")
      .eq("organization_id", parsedOrg.data)
      .order("created_at", { ascending: false })
      .limit(take),
    ctx.supabase
      .from("email_logs" as never)
      .select("id,to_email,subject,status,error_message,created_at")
      .eq("organization_id", parsedOrg.data)
      .order("created_at", { ascending: false })
      .limit(take),
  ]);

  if (audit.error) return NextResponse.json({ ok: false, message: audit.error.message }, { status: 500 });
  if (agent.error) return NextResponse.json({ ok: false, message: agent.error.message }, { status: 500 });
  if (email.error) return NextResponse.json({ ok: false, message: email.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    audit: audit.data ?? [],
    agent: agent.data ?? [],
    email: email.data ?? [],
  });
}
