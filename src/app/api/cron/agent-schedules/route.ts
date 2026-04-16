import { NextResponse } from "next/server";

import { z } from "zod";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processDueAgentSchedules } from "@/services/jobs/openclawScheduleRunner";

/**
 * Vercel Cron: GET /api/cron/agent-schedules?organizationId=<uuid>
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = env.server.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: "CRON_SECRET not configured" }, { status: 501 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsed = z.string().uuid().safeParse(organizationId);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY required for cron runner" },
      { status: 501 },
    );
  }
  const { data: member, error } = await admin
    .from("organization_members" as never)
    .select("user_id")
    .eq("organization_id", parsed.data)
    .in("role", ["admin", "operator"])
    .limit(1)
    .maybeSingle();

  if (error || !member) {
    return NextResponse.json({ ok: false, message: "No operator found for org" }, { status: 400 });
  }

  const actorUserId = (member as { user_id: string }).user_id;
  const result = await processDueAgentSchedules(admin, {
    organizationId: parsed.data,
    actorUserId,
    limit: 20,
  });

  return NextResponse.json({ ok: true, ...result });
}
