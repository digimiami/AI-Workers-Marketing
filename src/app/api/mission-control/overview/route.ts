import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { getMissionControlOverview } from "@/services/mission-control/missionControlOverview";

const qSchema = z.object({ organizationId: z.string().uuid() });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = qSchema.safeParse({ organizationId: url.searchParams.get("organizationId") });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  try {
    const overview = await getMissionControlOverview(ctx.supabase, parsed.data.organizationId);
    return NextResponse.json({ ok: true, ...overview });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Overview failed";
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
