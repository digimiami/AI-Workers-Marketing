import crypto from "crypto";
import { NextResponse } from "next/server";

import { z } from "zod";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/services/audit/auditService";

const bookSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  offer: z.string().min(2).max(240),
  trafficGoal: z.string().min(2).max(240),
  notes: z.string().max(2000).optional(),
});

function hashIp(ip: string | null) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bookSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid request" }, { status: 400 });
  }

  const organizationId = env.server.PUBLIC_LEAD_ORGANIZATION_ID;
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, message: "Lead capture is not configured yet." },
      { status: 503 },
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Supabase not configured" },
      { status: 503 },
    );
  }

  const campaignId = env.server.PUBLIC_LEAD_CAMPAIGN_ID ?? null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = request.headers.get("user-agent");
  const metadata = {
    source: "book_audit_form",
    offer: parsed.data.offer,
    traffic_goal: parsed.data.trafficGoal,
    notes: parsed.data.notes ?? null,
    user_agent: ua,
    ip_hash: hashIp(ip),
  };

  const { data: lead, error } = await admin
    .from("leads" as never)
    .upsert(
      {
        organization_id: organizationId,
        campaign_id: campaignId,
        email: parsed.data.email.toLowerCase(),
        full_name: parsed.data.name,
        source_page: "/book",
        metadata,
      } as never,
      { onConflict: "organization_id,email" },
    )
    .select("id")
    .single();

  if (error || !lead) {
    return NextResponse.json(
      { ok: false, message: error?.message ?? "Failed to capture lead" },
      { status: 500 },
    );
  }

  const leadId = (lead as { id: string }).id;
  await Promise.all([
    admin.from("lead_events" as never).insert({
      organization_id: organizationId,
      lead_id: leadId,
      event_type: "book_audit.requested",
      metadata,
    } as never),
    admin.from("analytics_events" as never).insert({
      organization_id: organizationId,
      campaign_id: campaignId,
      lead_id: leadId,
      event_name: "book_audit_requested",
      source: "public.book",
      metadata,
      user_agent: ua,
      ip_hash: hashIp(ip),
    } as never),
    writeAuditLog({
      organizationId,
      actorUserId: null,
      action: "lead.captured",
      entityType: "lead",
      entityId: leadId,
      metadata,
    }),
  ]);

  return NextResponse.json({ ok: true, leadId });
}
