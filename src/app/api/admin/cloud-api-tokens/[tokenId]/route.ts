import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revokeCloudApiToken } from "@/services/cloud/cloudApiTokensService";

const querySchema = z.object({
  organizationId: z.string().uuid(),
});

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await ctx.params;
  if (!z.string().uuid().safeParse(tokenId).success) {
    return NextResponse.json({ ok: false, message: "Invalid tokenId" }, { status: 400 });
  }
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ organizationId: url.searchParams.get("organizationId") });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId query required" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  try {
    const admin = createSupabaseAdminClient();
    await revokeCloudApiToken({
      admin,
      organizationId: parsed.data.organizationId,
      tokenId,
      actorUserId: orgCtx.user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Revoke failed";
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}
