import { NextResponse } from "next/server";

import {
  runWorkspaceStreamResponse,
  workspaceStreamQuerySchema,
} from "@/services/workspace/workspaceStreamRunner";

export const runtime = "nodejs";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = workspaceStreamQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.message }, { status: 400 });
  }
  return runWorkspaceStreamResponse(request, parsed.data, { liveStepEnvelope: true });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = workspaceStreamQuerySchema.safeParse(asRecord(body));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.message }, { status: 400 });
  }
  return runWorkspaceStreamResponse(request, parsed.data, { liveStepEnvelope: true });
}
