import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgOperator, orgIdQuery } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  listAgentCatalog,
  updateAgentCatalog,
} from "@/services/agents-marketplace/skillAdminService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = orgIdQuery.safeParse({
    organizationId: url.searchParams.get("organizationId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }
  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const admin = createSupabaseAdminClient();
  const catalog = await listAgentCatalog(admin);
  return NextResponse.json({ ok: true, catalog });
}

const patchSchema = z.object({
  organizationId: z.string().uuid(),
  slug: z.string().min(2),
  stripe_price_id: z.string().nullable().optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
  included_skill_keys: z.array(z.string()).optional(),
  monthly_price_cents: z.number().int().positive().optional(),
});

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const admin = createSupabaseAdminClient();
  const row = await updateAgentCatalog(admin, parsed.data.slug, {
    stripe_price_id: parsed.data.stripe_price_id,
    status: parsed.data.status,
    included_skill_keys: parsed.data.included_skill_keys,
    monthly_price_cents: parsed.data.monthly_price_cents,
  });

  return NextResponse.json({ ok: true, catalog: row });
}
