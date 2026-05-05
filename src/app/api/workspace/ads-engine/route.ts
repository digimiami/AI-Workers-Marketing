import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";

const platformSchema = z.enum(["meta", "google", "tiktok"]);
const objectiveSchema = z.enum(["leads", "traffic", "conversions"]);
const statusSchema = z.enum(["draft", "running", "paused"]);

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  action: z.enum(["get", "update_settings", "generate", "launch", "pause", "tick_autopilot"]),
  settings: z
    .object({
      platform: platformSchema.optional(),
      dailyBudget: z.number().min(1).max(100000).optional(),
      objective: objectiveSchema.optional(),
      autopilot: z.boolean().optional(),
    })
    .optional(),
});

type AdsEngineSettings = {
  platform: z.infer<typeof platformSchema>;
  daily_budget: number;
  objective: z.infer<typeof objectiveSchema>;
  status: z.infer<typeof statusSchema>;
  autopilot: boolean;
  landing_url?: string;
  updated_at?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function readAdsEngine(metadata: Record<string, unknown>): AdsEngineSettings {
  const ae = asMetadataRecord(metadata.ads_engine);
  const platform = platformSchema.safeParse(ae.platform).success ? (ae.platform as any) : ("meta" as const);
  const objective = objectiveSchema.safeParse(ae.objective).success ? (ae.objective as any) : ("leads" as const);
  const status = statusSchema.safeParse(ae.status).success ? (ae.status as any) : ("draft" as const);
  const daily_budget = typeof ae.daily_budget === "number" && Number.isFinite(ae.daily_budget) ? ae.daily_budget : 25;
  const autopilot = typeof ae.autopilot === "boolean" ? ae.autopilot : false;
  const landing_url = typeof ae.landing_url === "string" ? ae.landing_url : undefined;
  const updated_at = typeof ae.updated_at === "string" ? ae.updated_at : undefined;
  return { platform, objective, status, daily_budget, autopilot, landing_url, updated_at };
}

async function writeAdsEngine(params: {
  organizationId: string;
  campaignId: string;
  patch: Partial<AdsEngineSettings>;
}) {
  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingErr } = await admin
    .from("campaigns" as never)
    .select("metadata,funnel_id")
    .eq("organization_id", params.organizationId)
    .eq("id", params.campaignId)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  const prev = asMetadataRecord((existing as any)?.metadata);

  const funnelId = (existing as any)?.funnel_id ? String((existing as any).funnel_id) : null;
  const landingUrl = funnelId ? `/f/${params.campaignId}` : undefined;

  const adsEnginePatch: Record<string, unknown> = {
    ads_engine: {
      ...params.patch,
      landing_url: params.patch.landing_url ?? landingUrl,
      updated_at: nowIso(),
    },
  };

  const nextMeta = mergeJsonbRecords(prev, adsEnginePatch);

  const { data, error } = await admin
    .from("campaigns" as never)
    .update({ metadata: nextMeta, updated_at: nowIso() } as never)
    .eq("organization_id", params.organizationId)
    .eq("id", params.campaignId)
    .select("metadata")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return readAdsEngine(asMetadataRecord((data as any)?.metadata));
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const { organizationId, campaignId, action } = parsed.data;
  const orgCtx = await withOrgOperator(organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();

  const { data: camp, error: campErr } = await admin
    .from("campaigns" as never)
    .select("id,metadata,funnel_id")
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle();
  if (campErr) return NextResponse.json({ ok: false, message: campErr.message }, { status: 500 });
  if (!camp) return NextResponse.json({ ok: false, message: "Campaign not found" }, { status: 404 });

  const meta = asMetadataRecord((camp as any).metadata);
  const current = readAdsEngine(meta);

  if (action === "get") {
    const { count: creativesCount } = await admin
      .from("ad_creatives" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId);

    return NextResponse.json({
      ok: true,
      adsEngine: current,
      counts: { ad_creatives: creativesCount ?? 0 },
    });
  }

  if (action === "update_settings") {
    const s = parsed.data.settings ?? {};
    const patch: Partial<AdsEngineSettings> = {};
    if (s.platform) patch.platform = s.platform;
    if (typeof s.dailyBudget === "number") patch.daily_budget = s.dailyBudget;
    if (s.objective) patch.objective = s.objective;
    if (typeof s.autopilot === "boolean") patch.autopilot = s.autopilot;
    const next = await writeAdsEngine({ organizationId, campaignId, patch });
    return NextResponse.json({ ok: true, adsEngine: next });
  }

  if (action === "pause") {
    const next = await writeAdsEngine({ organizationId, campaignId, patch: { status: "paused" } });
    return NextResponse.json({ ok: true, adsEngine: next });
  }

  if (action === "launch") {
    // Simulated launch: mark running + emit a baseline metric event so dashboards have data.
    const next = await writeAdsEngine({ organizationId, campaignId, patch: { status: "running" } });
    await admin.from("analytics_events" as never).insert({
      organization_id: organizationId,
      campaign_id: campaignId,
      event_name: "ads_engine.launched",
      source: "ads_engine",
      properties: { platform: next.platform, objective: next.objective, daily_budget: next.daily_budget },
      created_at: nowIso(),
    } as never);
    return NextResponse.json({ ok: true, adsEngine: next });
  }

  if (action === "generate") {
    // MVP: map existing content hooks/scripts into ad_creatives rows.
    const platform = current.platform;
    const objective = current.objective;

    const { data: assets } = await admin
      .from("content_assets" as never)
      .select("id,title,angles,script_markdown,metadata")
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(200);

    const hooks: string[] = [];
    const scripts: string[] = [];
    for (const a of (assets ?? []) as any[]) {
      if (Array.isArray(a.angles)) {
        for (const x of a.angles) if (typeof x === "string" && x.trim()) hooks.push(x.trim());
      }
      if (typeof a.script_markdown === "string" && a.script_markdown.trim()) scripts.push(a.script_markdown.trim());
      if (hooks.length >= 20 && scripts.length >= 10) break;
    }

    const landingUrl = current.landing_url ?? `/f/${campaignId}`;
    const rows = Array.from({ length: 5 }).map((_, i) => {
      const hook = hooks[i] ?? `Hook ${i + 1}`;
      const script = scripts[i] ?? "";
      const headline = hook.slice(0, 120);
      const primary_text = script ? script.replace(/\n+/g, " ").slice(0, 600) : hook.slice(0, 200);
      return {
        organization_id: organizationId,
        campaign_id: campaignId,
        platform,
        format: platform === "google" ? "responsive_search" : "short_video",
        status: "draft",
        headline,
        primary_text,
        script_markdown: script || null,
        metadata: {
          ads_engine: true,
          objective,
          landing_url: landingUrl,
          source_hook: hook,
          generated_at: nowIso(),
        },
        updated_at: nowIso(),
      };
    });

    const { data: inserted, error } = await admin.from("ad_creatives" as never).insert(rows as never).select("id");
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    await admin.from("analytics_events" as never).insert({
      organization_id: organizationId,
      campaign_id: campaignId,
      event_name: "ads_engine.generated",
      source: "ads_engine",
      properties: { platform, objective, count: (inserted ?? []).length },
      created_at: nowIso(),
    } as never);

    return NextResponse.json({ ok: true, created: (inserted ?? []).length, landingUrl });
  }

  if (action === "tick_autopilot") {
    // Simulated optimization event.
    const next = await writeAdsEngine({ organizationId, campaignId, patch: { autopilot: true } });
    await admin.from("analytics_events" as never).insert({
      organization_id: organizationId,
      campaign_id: campaignId,
      event_name: "ads_engine.autopilot_tick",
      source: "ads_engine",
      properties: { platform: next.platform, note: "Simulated optimization tick" },
      created_at: nowIso(),
    } as never);
    return NextResponse.json({ ok: true, adsEngine: next });
  }

  return NextResponse.json({ ok: false, message: "Unknown action" }, { status: 400 });
}

