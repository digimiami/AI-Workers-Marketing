import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { writeAuditLog } from "@/services/audit/auditService";
import {
  deleteZernioOrgCredentials,
  getZernioConnectionStatus,
  saveZernioOrgCredentials,
} from "@/services/zernio/zernioMcp";

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
  const ctx = await withOrgMember(parsed.data);
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

  const ctx = await withOrgMember(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  if (parsed.data.disconnect) {
    await deleteZernioOrgCredentials(parsed.data.organizationId);
    return NextResponse.json({ ok: true, connected: false });
  }

  if (!parsed.data.apiKey) {
    return NextResponse.json({ ok: false, message: "apiKey required" }, { status: 400 });
  }

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
    metadata: { connected: true, surface: "ads_manager" },
  });

  const status = await getZernioConnectionStatus(parsed.data.organizationId);
  return NextResponse.json({ ok: true, ...status });
}
