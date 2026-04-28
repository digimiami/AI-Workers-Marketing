import crypto from "crypto";
import { NextResponse } from "next/server";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/services/audit/auditService";

const paramsSchema = z.object({ affiliateLinkId: z.string().uuid() });

function hashIp(ip: string | null) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ affiliateLinkId: string }> },
) {
  const { affiliateLinkId } = await ctx.params;
  const parsed = paramsSchema.safeParse({ affiliateLinkId });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid link id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const utm: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    if (k.startsWith("utm_")) utm[k] = v;
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Supabase not configured" },
      { status: 503 },
    );
  }
  const { data: link, error } = await admin
    .from("affiliate_links" as any)
    .select("id, organization_id, campaign_id, destination_url, utm_defaults, is_active")
    .eq("id", affiliateLinkId)
    .single();

  if (error || !link) {
    return NextResponse.json({ ok: false, message: "Link not found" }, { status: 404 });
  }
  if (!(link as any).is_active) {
    return NextResponse.json({ ok: false, message: "Link inactive" }, { status: 410 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = request.headers.get("user-agent");

  const destination = new URL((link as any).destination_url);
  const defaults = ((link as any).utm_defaults ?? {}) as Record<string, string>;
  for (const [k, v] of Object.entries({ ...defaults, ...utm })) {
    if (v && !destination.searchParams.has(k)) destination.searchParams.set(k, v);
  }

  const { data: click, error: clickErr } = await admin
    .from("affiliate_clicks" as any)
    .insert({
      organization_id: (link as any).organization_id ?? null,
      affiliate_link_id: (link as any).id,
      campaign_id: (link as any).campaign_id ?? null,
      utm: { ...defaults, ...utm },
      ip_hash: hashIp(ip),
      user_agent: ua,
    } as any)
    .select("id")
    .single();

  if (!clickErr) {
    // First-party click id propagation for downstream attribution.
    // - `cid` is a common affiliate postback click id parameter (e.g. Digistore24).
    // - `_tid` is our internal click id alias.
    if ((click as any)?.id) {
      const clickId = String((click as any).id);
      if (!destination.searchParams.has("cid")) destination.searchParams.set("cid", clickId);
      if (!destination.searchParams.has("_tid")) destination.searchParams.set("_tid", clickId);
    }

    await admin.from("analytics_events" as any).insert({
      organization_id: (link as any).organization_id ?? null,
      event_name: "affiliate_click",
      source: "api.affiliate.click",
      campaign_id: (link as any).campaign_id ?? null,
      metadata: { affiliate_link_id: (link as any).id, click_id: (click as any)?.id ?? null, utm: { ...defaults, ...utm } },
    } as any);

    await writeAuditLog({
      organizationId: (link as any).organization_id ?? null,
      actorUserId: null,
      action: "affiliate.clicked",
      entityType: "affiliate_link",
      entityId: (link as any).id,
      metadata: { click_id: (click as any)?.id ?? null },
    });
  }

  return NextResponse.redirect(destination.toString(), { status: 302 });
}

