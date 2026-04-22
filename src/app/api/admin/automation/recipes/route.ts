import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { listRunRecipes, upsertRunRecipe } from "@/services/automation/automationService";
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

  const recipes = await listRunRecipes(ctx.supabase, parsed.data);
  return NextResponse.json({ ok: true, recipes });
}

const upsertSchema = z.object({
  organizationId: z.string().uuid(),
  id: z.string().uuid().optional(),
  key: z.string().min(2).max(80),
  name: z.string().min(2).max(140),
  description: z.string().max(2000).optional().nullable(),
  default_agent_key: z.string().min(2).max(80),
  default_payload: z.record(z.string(), z.unknown()).optional(),
  payload_schema: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const row = await upsertRunRecipe(ctx.supabase, parsed.data.organizationId, {
    id: parsed.data.id,
    key: parsed.data.key,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    default_agent_key: parsed.data.default_agent_key,
    default_payload: parsed.data.default_payload,
    payload_schema: parsed.data.payload_schema,
    enabled: parsed.data.enabled,
  });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: ctx.user.id,
    action: "settings.updated",
    entityType: "recipe",
    entityId: (row as any)?.id,
    metadata: { op: "upsert", recipeKey: parsed.data.key },
  });

  return NextResponse.json({ ok: true, recipe: row });
}

