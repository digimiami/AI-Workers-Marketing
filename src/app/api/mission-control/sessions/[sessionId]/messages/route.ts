import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { listSessionMessages } from "@/services/mission-control/sessionService";

const qSchema = z.object({
  organizationId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export async function GET(
  request: Request,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await ctx.params;
  const url = new URL(request.url);
  const parsed = qSchema.safeParse({
    organizationId: url.searchParams.get("organizationId"),
    sessionId,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId and sessionId required" }, { status: 400 });
  }

  const orgCtx = await withOrgMember(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  try {
    const messages = await listSessionMessages(
      orgCtx.supabase,
      parsed.data.organizationId,
      parsed.data.sessionId,
    );
    return NextResponse.json({
      ok: true,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        workerKey: m.worker_key,
        intent: m.intent,
        suggestions: Array.isArray((m.metadata as { suggestions?: unknown })?.suggestions)
          ? ((m.metadata as { suggestions: string[] }).suggestions ?? [])
          : [],
        createdAt: m.created_at,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load messages";
    if (/mission_control|does not exist|schema cache/i.test(msg)) {
      return NextResponse.json({ ok: true, messages: [] });
    }
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
