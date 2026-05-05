import { NextResponse } from "next/server";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { liveWorkspaceBuildBodySchema, runLiveWorkspaceBuildStream } from "@/services/workspace/liveWorkspaceBuilder";

export const runtime = "nodejs";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function POST(request: Request) {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) return NextResponse.json({ ok: false, message: "No organization selected" }, { status: 401 });

  const orgCtx = await withOrgMember(orgId);
  if (orgCtx.error) return orgCtx.error;

  const json = await request.json().catch(() => null);
  const parsed = liveWorkspaceBuildBodySchema.safeParse(asRecord(json));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.message }, { status: 400 });
  }

  try {
    const stream = await runLiveWorkspaceBuildStream({
      request,
      orgId,
      userId: orgCtx.user.id,
      supabase: orgCtx.supabase,
      body: parsed.data,
    });
    return new NextResponse(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Failed to start live build" },
      { status: 400 },
    );
  }
}
