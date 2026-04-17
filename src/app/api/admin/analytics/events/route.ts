import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const limitRaw = url.searchParams.get("limit");
  const parsedOrg = z.string().uuid().safeParse(organizationId);
  if (!parsedOrg.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const limit = z.coerce.number().int().min(1).max(500).safeParse(limitRaw ?? "120");
  const take = limit.success ? limit.data : 120;

  const ctx = await withOrgMember(parsedOrg.data);
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.supabase
    .from("analytics_events" as never)
    .select("id,event_name,properties,source,session_id,created_at,campaign_id,campaigns(name)")
    .eq("organization_id", parsedOrg.data)
    .order("created_at", { ascending: false })
    .limit(take);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const events = (data ?? []) as {
    id: string;
    event_name: string;
    properties: Record<string, unknown>;
    source: string;
    session_id: string | null;
    created_at: string;
    campaign_id: string | null;
    campaigns: { name: string } | null;
  }[];

  const totals = new Map<string, number>();
  for (const e of events) {
    totals.set(e.event_name, (totals.get(e.event_name) ?? 0) + 1);
  }
  const topEvents = [...totals.entries()]
    .map(([event_name, count]) => ({ event_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return NextResponse.json({
    ok: true,
    events: events.map((e) => ({
      id: e.id,
      event_name: e.event_name,
      properties: e.properties,
      source: e.source,
      session_id: e.session_id,
      created_at: e.created_at,
      campaign_id: e.campaign_id,
      campaign_name: e.campaigns?.name ?? null,
    })),
    topEvents,
  });
}
