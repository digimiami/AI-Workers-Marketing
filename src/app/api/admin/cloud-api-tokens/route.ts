import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCloudApiToken, listCloudApiTokens } from "@/services/cloud/cloudApiTokensService";

const listQuery = z.object({
  organizationId: z.string().uuid(),
});

const postBody = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  /** Defaults to the logged-in user; must be an operator for the org. */
  actorUserId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = listQuery.safeParse({ organizationId: url.searchParams.get("organizationId") });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId query required" }, { status: 400 });
  }
  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const admin = createSupabaseAdminClient();
  const tokens = await listCloudApiTokens(admin, parsed.data.organizationId);
  return NextResponse.json({ ok: true, tokens });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = postBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const admin = createSupabaseAdminClient();
  const actorUserId = parsed.data.actorUserId ?? ctx.user.id;

  try {
    const created = await createCloudApiToken({
      admin,
      organizationId: parsed.data.organizationId,
      createdByUserId: ctx.user.id,
      actorUserId,
      name: parsed.data.name,
    });
    return NextResponse.json({
      ok: true,
      id: created.id,
      token_prefix: created.token_prefix,
      /** Shown once. Store in your agent / OpenClaw secret manager. */
      plain_token: created.plain_token,
      endpoint: "/api/v1/cloud/tools/run",
      auth: "Authorization: Bearer <plain_token>",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}
