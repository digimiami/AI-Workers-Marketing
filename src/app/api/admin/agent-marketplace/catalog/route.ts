import { NextResponse } from "next/server";

/** Moved to agents.aiworkers.vip — use /api/agents-platform/catalog with platform admin token. */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: "Agent marketplace admin moved to agents.aiworkers.vip/admin",
      code: "MOVED_TO_AGENTS_SITE",
    },
    { status: 410 },
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      ok: false,
      message: "Agent marketplace admin moved to agents.aiworkers.vip/admin",
      code: "MOVED_TO_AGENTS_SITE",
    },
    { status: 410 },
  );
}
