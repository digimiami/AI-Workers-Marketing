import crypto from "crypto";
import { NextResponse } from "next/server";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/services/audit/auditService";

const schema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  email: z.string().email(),
  fullName: z.string().min(1).optional(),
  phone: z.string().min(6).optional(),
  sourcePage: z.string().optional(),
  sourceContentAssetId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function hashIp(ip: string | null) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid payload" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = request.headers.get("user-agent");

  const { data: lead, error } = await admin
    .from("leads" as any)
    .upsert(
      {
        organization_id: parsed.data.organizationId,
        campaign_id: parsed.data.campaignId ?? null,
        email: parsed.data.email.toLowerCase(),
        full_name: parsed.data.fullName ?? null,
        phone: parsed.data.phone ?? null,
        source_page: parsed.data.sourcePage ?? null,
        source_content_asset_id: parsed.data.sourceContentAssetId ?? null,
        metadata: {
          ...(parsed.data.metadata ?? {}),
          user_agent: ua,
          ip_hash: hashIp(ip),
        },
      } as any,
      { onConflict: "organization_id,email" },
    )
    .select("id, organization_id, campaign_id, email")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 },
    );
  }

  await admin.from("lead_events" as any).insert({
    organization_id: parsed.data.organizationId,
    lead_id: (lead as any).id,
    event_type: "lead.captured",
    metadata: {
      source_page: parsed.data.sourcePage ?? null,
      source_content_asset_id: parsed.data.sourceContentAssetId ?? null,
    },
  } as any);

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: null,
    action: "lead.captured",
    entityType: "lead",
    entityId: (lead as any).id,
    metadata: { campaign_id: parsed.data.campaignId ?? null },
  });

  return NextResponse.json({ ok: true, leadId: (lead as any).id });
}

