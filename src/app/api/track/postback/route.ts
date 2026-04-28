import crypto from "crypto";
import { NextResponse } from "next/server";

import { z } from "zod";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  click_id: z.string().uuid().optional(),
  cid: z.string().uuid().optional(),
  _tid: z.string().uuid().optional(),
  revenue: z.string().optional(),
  amount: z.string().optional(),
  status: z.string().optional(),
  transaction_type: z.string().optional(),
  secret: z.string().optional(),
});

function parseMoneyToCents(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function hashIp(ip: string | null) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

/**
 * Affiliate network postback endpoint (first-party).
 *
 * Example (Digistore24):
 *   /api/track/postback?click_id={cid}&revenue={amount_affiliate}&status={transaction_type}
 *
 * Supported click id params:
 * - click_id (preferred)
 * - cid (common affiliate param)
 * - _tid (internal alias)
 *
 * Security:
 * - If POSTBACK_SECRET is set on the server, the request must include ?secret=...
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid query" }, { status: 400 });
  }

  const secret = env.server.POSTBACK_SECRET;
  if (secret && parsed.data.secret !== secret) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const clickId = parsed.data.click_id ?? parsed.data.cid ?? parsed.data._tid ?? null;
  if (!clickId) {
    return NextResponse.json({ ok: false, message: "click_id required" }, { status: 400 });
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

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = request.headers.get("user-agent");

  const { data: clickRow } = await admin
    .from("affiliate_clicks" as any)
    .select("id, organization_id, campaign_id, funnel_id, funnel_step_id, source_page, utm")
    .eq("id", clickId)
    .maybeSingle();

  const click = clickRow as any;

  // Be resilient: respond OK even if the click wasn't found (network retries / delayed sync).
  if (!click) {
    await admin.from("analytics_events" as any).insert({
      organization_id: null,
      event_name: "affiliate_postback_unmatched_click",
      source: "api.track.postback",
      metadata: {
        click_id: clickId,
        revenue: parsed.data.revenue ?? parsed.data.amount ?? null,
        status: parsed.data.status ?? parsed.data.transaction_type ?? null,
        ip_hash: hashIp(ip),
        user_agent: ua,
      },
    } as any);
    return NextResponse.json({ ok: true, matched: false });
  }

  const cents = parseMoneyToCents(parsed.data.revenue ?? parsed.data.amount ?? null);
  const status = parsed.data.status ?? parsed.data.transaction_type ?? "unknown";

  const { data: conv, error: convErr } = await admin
    .from("conversions" as any)
    .insert({
      organization_id: click.organization_id,
      campaign_id: click.campaign_id ?? null,
      lead_id: null,
      conversion_type: "affiliate.postback",
      value_cents: cents,
      metadata: {
        click_id: clickId,
        network: "postback",
        status,
        utm: click.utm ?? null,
        funnel_id: click.funnel_id ?? null,
        funnel_step_id: click.funnel_step_id ?? null,
        source_page: click.source_page ?? null,
        ip_hash: hashIp(ip),
        user_agent: ua,
      },
    } as any)
    .select("id")
    .single();

  if (convErr) {
    return NextResponse.json({ ok: false, message: convErr.message }, { status: 500 });
  }

  await admin.from("analytics_events" as any).insert({
    organization_id: click.organization_id,
    campaign_id: click.campaign_id ?? null,
    event_name: "affiliate_postback",
    source: "api.track.postback",
    metadata: { conversion_id: (conv as any)?.id ?? null, click_id: clickId, status, value_cents: cents },
    user_agent: ua,
    ip_hash: hashIp(ip),
    session_id: null,
  } as any);

  return NextResponse.json({ ok: true, matched: true, conversion_id: (conv as any)?.id ?? null });
}

