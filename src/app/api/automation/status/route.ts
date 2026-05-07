import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enqueueAutomationJob } from "@/services/automation/jobRunner";

const qSchema = z.object({ organizationId: z.string().uuid() });

function isAutoEnabled(metadata: unknown) {
  const ge = asMetadataRecord(asMetadataRecord(metadata).growth_engine);
  const auto = asMetadataRecord(ge.auto_mode);
  return Boolean(auto.enabled);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = qSchema.safeParse({ organizationId: url.searchParams.get("organizationId") });
  if (!parsed.success) return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });

  const ctx = await withOrgMember(parsed.data.organizationId);
  if (ctx.error) return ctx.error;
  const orgId = parsed.data.organizationId;

  const [campaigns, postsScheduled, postsPosted, jobsQueued, jobsRunning, latestMetrics] = await Promise.all([
    ctx.supabase
      .from("campaigns" as never)
      .select("id,name,status,target_audience,metadata,created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
    ctx.supabase.from("content_posts" as never).select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "scheduled"),
    ctx.supabase.from("content_posts" as never).select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "posted"),
    ctx.supabase.from("jobs" as never).select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "queued"),
    ctx.supabase.from("jobs" as never).select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "running"),
    ctx.supabase
      .from("metrics" as never)
      .select("key,value_numeric,value_json,captured_at,campaign_id")
      .eq("organization_id", orgId)
      .order("captured_at", { ascending: false })
      .limit(20),
  ]);

  if (campaigns.error) return NextResponse.json({ ok: false, message: campaigns.error.message }, { status: 500 });

  const rows = ((campaigns.data ?? []) as any[]).map((c) => {
    const ge = asMetadataRecord(asMetadataRecord(c.metadata).growth_engine);
    const auto = asMetadataRecord(ge.auto_mode);
    return {
      id: String(c.id),
      name: String(c.name),
      status: String(c.status ?? "draft"),
      targetAudience: String(c.target_audience ?? ""),
      autoMode: {
        enabled: Boolean(auto.enabled),
        autoLaunchApproved: Boolean(auto.auto_launch_approved),
        autoScaleApproved: Boolean(auto.auto_scale_approved),
        lastOptimizedAt: typeof auto.last_optimized_at === "string" ? auto.last_optimized_at : null,
      },
    };
  });

  return NextResponse.json({
    ok: true,
    campaigns: rows,
    summary: {
      autoModeEnabled: rows.some((c) => c.autoMode.enabled),
      activeCampaigns: rows.filter((c) => c.autoMode.enabled).length,
      content: {
        scheduled: postsScheduled.count ?? 0,
        posted: postsPosted.count ?? 0,
      },
      jobs: {
        queued: jobsQueued.count ?? 0,
        running: jobsRunning.count ?? 0,
      },
      metrics: latestMetrics.data ?? [],
    },
  });
}

const postSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  enabled: z.boolean(),
  autoLaunchApproved: z.boolean().optional(),
  autoScaleApproved: z.boolean().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const admin = createSupabaseAdminClient();
  const { data: camp, error } = await admin
    .from("campaigns" as never)
    .select("id,name,target_audience,description,metadata")
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", parsed.data.campaignId)
    .maybeSingle();
  if (error || !camp) return NextResponse.json({ ok: false, message: error?.message ?? "Campaign not found" }, { status: 404 });

  const prev = asMetadataRecord((camp as any).metadata);
  const next = mergeJsonbRecords(prev, {
    growth_engine: {
      auto_mode: {
        enabled: parsed.data.enabled,
        auto_launch_approved: Boolean(parsed.data.autoLaunchApproved),
        auto_scale_approved: Boolean(parsed.data.autoScaleApproved),
        target_cpl: 30,
        min_conversion_rate: 0.08,
        updated_at: new Date().toISOString(),
      },
    },
  });

  const wasEnabled = isAutoEnabled(prev);
  await admin
    .from("campaigns" as never)
    .update({ metadata: next, status: parsed.data.enabled ? "active" : "paused", updated_at: new Date().toISOString() } as never)
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", parsed.data.campaignId);

  const jobs: string[] = [];
  if (parsed.data.enabled && !wasEnabled) {
    const campaignName = String((camp as any).name ?? "Growth campaign");
    const audience = String((camp as any).target_audience ?? "target buyers");
    const goal =
      typeof asMetadataRecord(prev.growth_engine).goal === "string"
        ? String(asMetadataRecord(prev.growth_engine).goal)
        : "Generate qualified leads";
    const basePayload = { campaignId: parsed.data.campaignId, campaignName, goal, audience, ctaLink: `/f/${parsed.data.campaignId}` };
    jobs.push(
      await enqueueAutomationJob({
        organizationId: parsed.data.organizationId,
        campaignId: parsed.data.campaignId,
        userId: ctx.user.id,
        type: "content_generation",
        payload: basePayload,
        priority: 20,
      }),
    );
    jobs.push(
      await enqueueAutomationJob({
        organizationId: parsed.data.organizationId,
        campaignId: parsed.data.campaignId,
        userId: ctx.user.id,
        type: "ads_auto_launch",
        payload: { campaignId: parsed.data.campaignId },
        priority: 40,
      }),
    );
    jobs.push(
      await enqueueAutomationJob({
        organizationId: parsed.data.organizationId,
        campaignId: parsed.data.campaignId,
        userId: ctx.user.id,
        type: "optimize_campaigns",
        payload: { campaignId: parsed.data.campaignId },
        priority: 60,
      }),
    );
  }

  return NextResponse.json({ ok: true, autoMode: { enabled: parsed.data.enabled }, jobs });
}

