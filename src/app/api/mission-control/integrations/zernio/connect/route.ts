import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { writeAuditLog } from "@/services/audit/auditService";
import { getZernioConnectionStatus, saveZernioOrgCredentials } from "@/services/zernio/zernioMcp";

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

  const ctx = await withOrgMember(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const saved = await saveZernioOrgCredentials(parsed.data.organizationId, {
    apiKey: parsed.data.apiKey,
    serverUrl: parsed.data.serverUrl ?? null,
  });
  if (!saved.ok) return NextResponse.json({ ok: false, message: saved.error }, { status: 500 });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: ctx.user.id,
    action: "settings.updated",
    entityType: "zernio_mcp",
    entityId: "zernio_mcp",
    metadata: { connected: true, surface: "mission_control" },
  });

  const status = await getZernioConnectionStatus(parsed.data.organizationId);
  return NextResponse.json({ ok: true, ...status });
}

