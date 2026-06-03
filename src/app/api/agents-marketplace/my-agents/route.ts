import { NextResponse } from "next/server";

import { orgIdQuery, withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { listOrganizationAgentLicenses } from "@/services/agents-marketplace/provisionService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = orgIdQuery.safeParse({
    organizationId: url.searchParams.get("organizationId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const licenses = await listOrganizationAgentLicenses(ctx.supabase, parsed.data.organizationId);
  return NextResponse.json({ ok: true, licenses });
}
