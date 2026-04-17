import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const contentStatus = z.enum(["draft", "approved", "scheduled", "published", "archived"]);

const createBody = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(1),
  campaign_id: z.string().uuid().nullable().optional(),
  funnel_id: z.string().uuid().nullable().optional(),
  status: contentStatus.optional(),
  script_markdown: z.string().nullable().optional(),
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
    .from("content_assets" as never)
    .select(
      "id,title,status,campaign_id,funnel_id,created_at,updated_at,campaigns(name),funnels(name)",
    )
    .eq("organization_id", parsed.data)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const rows = (data ?? []) as {
    id: string;
    title: string;
    status: string;
    campaign_id: string | null;
    funnel_id: string | null;
    created_at: string;
    updated_at: string;
    campaigns: { name: string } | null;
    funnels: { name: string } | null;
  }[];

  const assets = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    campaign_id: r.campaign_id,
    funnel_id: r.funnel_id,
    campaign_name: r.campaigns?.name ?? null,
    funnel_name: r.funnels?.name ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return NextResponse.json({ ok: true, assets });
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
    .from("content_assets" as never)
    .insert({
      organization_id: parsed.data.organizationId,
      title: parsed.data.title,
      campaign_id: parsed.data.campaign_id ?? null,
      funnel_id: parsed.data.funnel_id ?? null,
      status: parsed.data.status ?? "draft",
      script_markdown: parsed.data.script_markdown ?? null,
    } as never)
    .select("id,title,status,campaign_id,funnel_id,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, asset: data });
}
