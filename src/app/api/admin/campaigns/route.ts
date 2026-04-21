import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { writeAuditLog } from "@/services/audit/auditService";

const createSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
  type: z.enum(["affiliate", "lead_gen", "internal_test", "client"]).default("affiliate"),
  status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
  targetAudience: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsedOrg = z.string().uuid().safeParse(organizationId);
  if (!parsedOrg.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsedOrg.data);
  if (ctx.error) return ctx.error;

  const { data: campaigns, error } = await ctx.supabase
    .from("campaigns" as never)
    .select("id,name,type,status,target_audience,description,created_at,updated_at")
    .eq("organization_id", parsedOrg.data)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  // Basic relationship counts for dashboard usability.
  const [funnels, leads, assets, events] = await Promise.all([
    ctx.supabase
      .from("funnels" as never)
      .select("campaign_id")
      .eq("organization_id", parsedOrg.data)
      .not("campaign_id", "is", null)
      .limit(2000),
    ctx.supabase
      .from("leads" as never)
      .select("campaign_id")
      .eq("organization_id", parsedOrg.data)
      .not("campaign_id", "is", null)
      .limit(5000),
    ctx.supabase
      .from("content_assets" as never)
      .select("campaign_id")
      .eq("organization_id", parsedOrg.data)
      .not("campaign_id", "is", null)
      .limit(5000),
    ctx.supabase
      .from("analytics_events" as never)
      .select("campaign_id")
      .eq("organization_id", parsedOrg.data)
      .not("campaign_id", "is", null)
      .limit(10000),
  ]);

  const countBy = (rows: unknown[] | null | undefined) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      const id = (r as { campaign_id: string | null }).campaign_id;
      if (!id) continue;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  };

  const funnelCounts = funnels.error ? new Map<string, number>() : countBy(funnels.data);
  const leadCounts = leads.error ? new Map<string, number>() : countBy(leads.data);
  const assetCounts = assets.error ? new Map<string, number>() : countBy(assets.data);
  const eventCounts = events.error ? new Map<string, number>() : countBy(events.data);

  const enriched = (campaigns ?? []).map((c: any) => ({
    ...c,
    funnel_count: funnelCounts.get(c.id) ?? 0,
    lead_count: leadCounts.get(c.id) ?? 0,
    content_asset_count: assetCounts.get(c.id) ?? 0,
    analytics_event_count: eventCounts.get(c.id) ?? 0,
  }));

  return NextResponse.json({ ok: true, campaigns: enriched });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.supabase
    .from("campaigns" as never)
    .insert({
      organization_id: parsed.data.organizationId,
      name: parsed.data.name,
      type: parsed.data.type,
      status: parsed.data.status,
      target_audience: parsed.data.targetAudience ?? null,
      description: parsed.data.description ?? null,
    } as never)
    .select("id,name,type,status,target_audience,description,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: ctx.user.id,
    action: "campaign.created",
    entityType: "campaign",
    entityId: (data as any)?.id,
    metadata: { name: parsed.data.name },
  });

  return NextResponse.json({ ok: true, campaign: data });
}

