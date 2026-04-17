import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const funnelStatus = z.enum(["draft", "active", "paused", "archived"]);

const createBody = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  campaign_id: z.string().uuid().nullable().optional(),
  status: funnelStatus.optional(),
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

  const { data, error } = await ctx.supabase
    .from("funnels" as never)
    .select(
      "id,name,status,campaign_id,metadata,created_at,updated_at,campaigns(name),funnel_steps(id)",
    )
    .eq("organization_id", parsed.data)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const rows = (data ?? []) as {
    id: string;
    name: string;
    status: string;
    campaign_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    campaigns: { name: string } | null;
    funnel_steps: { id: string }[] | null;
  }[];

  const funnels = rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    campaign_id: r.campaign_id,
    campaign_name: r.campaigns?.name ?? null,
    step_count: r.funnel_steps?.length ?? 0,
    metadata: r.metadata,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return NextResponse.json({ ok: true, funnels });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.supabase
    .from("funnels" as never)
    .insert({
      organization_id: parsed.data.organizationId,
      name: parsed.data.name,
      campaign_id: parsed.data.campaign_id ?? null,
      status: parsed.data.status ?? "draft",
    } as never)
    .select("id,name,status,campaign_id,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, funnel: data });
}
