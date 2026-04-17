import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { listSettings, upsertSetting } from "@/services/settings/settingsService";
import { writeAuditLog } from "@/services/audit/auditService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsed = z.string().uuid().safeParse(organizationId);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data);
  if (ctx.error) return ctx.error;

  const rows = await listSettings(ctx.supabase, parsed.data);
  return NextResponse.json({ ok: true, settings: rows });
}

const postSchema = z.object({
  organizationId: z.string().uuid(),
  key: z.string().min(1).max(120),
  value: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const row = await upsertSetting(ctx.supabase, parsed.data.organizationId, parsed.data.key, parsed.data.value);

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: ctx.user.id,
    action: "settings.updated",
    entityType: "settings",
    entityId: parsed.data.key,
    metadata: { key: parsed.data.key },
  });

  return NextResponse.json({ ok: true, setting: row });
}
