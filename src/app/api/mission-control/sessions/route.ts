import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { listRecentSessions } from "@/services/mission-control/sessionService";

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
    const sessions = await listRecentSessions(ctx.supabase, parsed.data.organizationId);
    return NextResponse.json({ ok: true, sessions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list sessions";
    if (/mission_control|does not exist|schema cache/i.test(msg)) {
      return NextResponse.json({ ok: true, sessions: [] });
    }
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
