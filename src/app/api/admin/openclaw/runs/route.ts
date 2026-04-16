import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import type { OpenClawRunStatus } from "@/lib/openclaw/types";
import { listRuns } from "@/services/openclaw/orchestrationService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const status = url.searchParams.get("status") as OpenClawRunStatus | undefined;

  const parsedOrg = z.string().uuid().safeParse(organizationId);
  if (!parsedOrg.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsedOrg.data);
  if (ctx.error) return ctx.error;

  const runs = await listRuns(ctx.supabase, parsedOrg.data, {
    agentId: agentId && z.string().uuid().safeParse(agentId).success ? agentId : undefined,
    status: status && ["pending", "running", "success", "failed", "approved", "rejected"].includes(status) ? status : undefined,
  });

  return NextResponse.json({ ok: true, runs });
}
