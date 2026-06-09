import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/services/audit/auditService";
import { encryptJson } from "@/services/platforms/credentialsCrypto";
import { getZernioConnectionStatus } from "@/services/zernio/zernioMcp";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  apiKey: z.string().min(10).optional(),
  serverUrl: z.string().url().optional(),
  disconnect: z.boolean().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsed = z.string().uuid().safeParse(organizationId);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }
  const ctx = await withOrgOperator(parsed.data);
  if (ctx.error) return ctx.error;
  const status = await getZernioConnectionStatus(parsed.data);
  return NextResponse.json({ ok: true, ...status });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const admin = createSupabaseAdminClient();

  if (parsed.data.disconnect) {
    await admin
      .from("organization_ad_credentials" as never)
      .delete()
      .eq("organization_id", parsed.data.organizationId)
      .eq("platform", "zernio_mcp");
    return NextResponse.json({ ok: true, connected: false });
  }

  if (!parsed.data.apiKey) {
    return NextResponse.json({ ok: false, message: "apiKey required" }, { status: 400 });
  }

  const encrypted = encryptJson({
    api_key: parsed.data.apiKey,
    server_url: parsed.data.serverUrl ?? null,
  });

  const { error } = await admin
    .from("organization_ad_credentials" as never)
    .upsert(
      {
        organization_id: parsed.data.organizationId,
        platform: "zernio_mcp",
        encrypted,
        status: { connected: true, missing: [] as string[] },
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "organization_id,platform" },
    );
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: ctx.user.id,
    action: "settings.updated",
    entityType: "zernio_mcp",
    entityId: "zernio_mcp",
    metadata: { connected: true, surface: "ads_manager" },
  });

  const status = await getZernioConnectionStatus(parsed.data.organizationId);
  return NextResponse.json({ ok: true, ...status });
}
