import crypto from "crypto";
import { NextResponse } from "next/server";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const eventSchema = z.object({
  organizationId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  eventName: z.string().min(1),
  properties: z.record(z.string(), z.unknown()).optional(),
  source: z.string().default("internal"),
  sessionId: z.string().optional(),
});

function hashIp(ip: string | null) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid payload" },
      { status: 400 },
    );
  }

  const ua = request.headers.get("user-agent");
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("analytics_events" as any).insert({
    organization_id: parsed.data.organizationId ?? null,
    campaign_id: parsed.data.campaignId ?? null,
    lead_id: parsed.data.leadId ?? null,
    event_name: parsed.data.eventName,
    properties: parsed.data.properties ?? {},
    source: parsed.data.source,
    session_id: parsed.data.sessionId ?? null,
    user_agent: ua,
    ip_hash: hashIp(ip),
  } as any);

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

