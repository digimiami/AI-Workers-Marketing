import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { provisionAgentForOrganization } from "@/services/agents-marketplace/provisionService";

export const runtime = "nodejs";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  agentSlug: z.string().min(2),
});

/** Start a trial without Stripe (dev / sales-assisted). */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const result = await provisionAgentForOrganization(admin, {
    organizationId: parsed.data.organizationId,
    agentCatalogSlug: parsed.data.agentSlug,
    source: "trial",
  });

  return NextResponse.json({ ok: true, ...result });
}
