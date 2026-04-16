import { NextResponse } from "next/server";

import { z } from "zod";

import { describeOpenClawBackend } from "@/lib/openclaw/factory";
import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import {
  listAgents,
  syncAgentsAndTemplates,
} from "@/services/openclaw/orchestrationService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsed = z.string().uuid().safeParse(organizationId);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data);
  if (ctx.error) return ctx.error;

  const agents = await listAgents(ctx.supabase, parsed.data);
  return NextResponse.json({
    ok: true,
    agents,
    backend: describeOpenClawBackend(),
  });
}

const syncBody = z.object({ organizationId: z.string().uuid() });

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = syncBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  await syncAgentsAndTemplates(ctx.supabase, parsed.data.organizationId);
  const agents = await listAgents(ctx.supabase, parsed.data.organizationId);
  return NextResponse.json({ ok: true, agents });
}
