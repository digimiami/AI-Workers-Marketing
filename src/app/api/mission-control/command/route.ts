import { NextResponse } from "next/server";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { missionCommandBodySchema } from "@/domain/mission-control/types";
import { processMissionCommand } from "@/services/mission-control/commandOrchestrator";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = missionCommandBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  try {
    const result = await processMissionCommand({
      db: ctx.supabase,
      organizationId: parsed.data.organizationId,
      userId: ctx.user.id,
      message: parsed.data.message,
      sessionId: parsed.data.sessionId,
      campaignId: parsed.data.campaignId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Command failed";
    if (/mission_control|business_memory|does not exist|schema cache/i.test(msg)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Mission Control tables not migrated. Apply supabase/migrations/20260601120000_mission_control.sql",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
