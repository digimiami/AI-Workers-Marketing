import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { writeAuditLog } from "@/services/audit/auditService";
import { encryptJson } from "@/services/platforms/credentialsCrypto";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  apiKey: z.string().min(10),
  serverUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const encrypted = encryptJson({
    api_key: parsed.data.apiKey,
    server_url: parsed.data.serverUrl ?? null,
  });
  const status = { connected: true, missing: [] as string[] };

  const { error } = await ctx.supabase
    .from("organization_ad_credentials" as never)
    .upsert(
      {
        organization_id: parsed.data.organizationId,
        platform: "zernio_mcp",
        encrypted,
        status,
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
    metadata: { connected: true },
  });

  return NextResponse.json({ ok: true, connected: true });
}

