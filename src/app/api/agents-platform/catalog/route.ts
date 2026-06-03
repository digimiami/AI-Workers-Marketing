import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  listAgentCatalog,
  updateAgentCatalog,
} from "@/services/agents-marketplace/skillAdminService";

import { jsonWithCors, optionsResponse, withPlatformAdmin } from "../_shared";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return optionsResponse(req);
}

export async function GET(req: Request) {
  const gate = withPlatformAdmin(req);
  if (gate.error) return gate.error;

  const admin = createSupabaseAdminClient();
  const catalog = await listAgentCatalog(admin);
  return jsonWithCors(req, { ok: true, catalog });
}

const patchSchema = z.object({
  slug: z.string().min(2),
  stripe_price_id: z.string().nullable().optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
  included_skill_keys: z.array(z.string()).optional(),
  monthly_price_cents: z.number().int().positive().optional(),
});

export async function PATCH(req: Request) {
  const gate = withPlatformAdmin(req);
  if (gate.error) return gate.error;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return jsonWithCors(req, { ok: false, message: "Invalid body" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const row = await updateAgentCatalog(admin, parsed.data.slug, {
    stripe_price_id: parsed.data.stripe_price_id,
    status: parsed.data.status,
    included_skill_keys: parsed.data.included_skill_keys,
    monthly_price_cents: parsed.data.monthly_price_cents,
  });

  return jsonWithCors(req, { ok: true, catalog: row });
}
