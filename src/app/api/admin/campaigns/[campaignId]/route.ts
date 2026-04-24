import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { writeAuditLog } from "@/services/audit/auditService";

const getQuery = z.object({
  organizationId: z.string().uuid(),
});

const patchBody = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2).optional(),
  type: z.enum(["affiliate", "lead_gen", "internal_test", "client"]).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  targetAudience: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const deleteBody = z.object({
  organizationId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await ctx.params;
  if (!z.string().uuid().safeParse(campaignId).success) {
    return NextResponse.json({ ok: false, message: "Invalid campaignId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.type !== undefined) patch.type = parsed.data.type;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.targetAudience !== undefined) patch.target_audience = parsed.data.targetAudience;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.metadata !== undefined) {
    const { data: existing, error: existingErr } = await op.supabase
      .from("campaigns" as never)
      .select("metadata")
      .eq("id", campaignId)
      .eq("organization_id", parsed.data.organizationId)
      .maybeSingle();
    if (existingErr) return NextResponse.json({ ok: false, message: existingErr.message }, { status: 500 });
    const prev = asMetadataRecord((existing as { metadata?: unknown } | null)?.metadata);
    patch.metadata = mergeJsonbRecords(prev, parsed.data.metadata);
  }

  const { data, error } = await op.supabase
    .from("campaigns" as never)
    .update(patch as never)
    .eq("id", campaignId)
    .eq("organization_id", parsed.data.organizationId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: "Campaign not found" }, { status: 404 });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: op.user.id,
    action: "campaign.updated",
    entityType: "campaign",
    entityId: campaignId,
    metadata: { fields: Object.keys(patch).filter((k) => k !== "updated_at") },
  });

  return NextResponse.json({ ok: true, campaign: data });
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await ctx.params;
  if (!z.string().uuid().safeParse(campaignId).success) {
    return NextResponse.json({ ok: false, message: "Invalid campaignId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsed = getQuery.safeParse({ organizationId: url.searchParams.get("organizationId") });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctxOrg = await withOrgOperator(parsed.data.organizationId);
  if (ctxOrg.error) return ctxOrg.error;

  const { data, error } = await ctxOrg.supabase
    .from("campaigns" as never)
    .select("*")
    .eq("id", campaignId)
    .eq("organization_id", parsed.data.organizationId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: "Campaign not found" }, { status: 404 });
  return NextResponse.json({ ok: true, campaign: data });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await ctx.params;
  if (!z.string().uuid().safeParse(campaignId).success) {
    return NextResponse.json({ ok: false, message: "Invalid campaignId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  // Dependency checks: prevent deleting a campaign that still has linked records.
  const [funnels, leads, assets] = await Promise.all([
    op.supabase
      .from("funnels" as never)
      .select("id")
      .eq("organization_id", parsed.data.organizationId)
      .eq("campaign_id", campaignId)
      .limit(1),
    op.supabase
      .from("leads" as never)
      .select("id")
      .eq("organization_id", parsed.data.organizationId)
      .eq("campaign_id", campaignId)
      .limit(1),
    op.supabase
      .from("content_assets" as never)
      .select("id")
      .eq("organization_id", parsed.data.organizationId)
      .eq("campaign_id", campaignId)
      .limit(1),
  ]);

  if ((funnels.data?.length ?? 0) > 0 || (leads.data?.length ?? 0) > 0 || (assets.data?.length ?? 0) > 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Campaign has linked funnels/leads/content. Unlink or delete dependencies before deleting the campaign.",
      },
      { status: 409 },
    );
  }

  const { error } = await op.supabase
    .from("campaigns" as never)
    .delete()
    .eq("id", campaignId)
    .eq("organization_id", parsed.data.organizationId);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: op.user.id,
    action: "campaign.updated",
    entityType: "campaign",
    entityId: campaignId,
    metadata: { op: "deleted" },
  });

  return NextResponse.json({ ok: true });
}

