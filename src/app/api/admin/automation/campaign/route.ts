import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import {
  getCampaignAutomationSettings,
  upsertCampaignAutomationSettings,
} from "@/services/automation/automationService";
import { writeAuditLog } from "@/services/audit/auditService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const campaignId = url.searchParams.get("campaignId");

  const parsedOrg = z.string().uuid().safeParse(organizationId);
  const parsedCampaign = z.string().uuid().safeParse(campaignId);
  if (!parsedOrg.success || !parsedCampaign.success) {
    return NextResponse.json({ ok: false, message: "organizationId + campaignId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsedOrg.data);
  if (ctx.error) return ctx.error;

  const settings = await getCampaignAutomationSettings(ctx.supabase, parsedOrg.data, parsedCampaign.data);
  return NextResponse.json({ ok: true, settings });
}

const upsertSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  automation_enabled: z.boolean(),
  auto_generate_content_drafts: z.boolean(),
  auto_run_analyst_weekly: z.boolean(),
  require_approval_before_publish: z.boolean(),
  require_approval_before_email: z.boolean(),
  auto_log_analytics_reviews: z.boolean(),
  max_runs_per_day: z.number().int().min(0).max(50),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const row = await upsertCampaignAutomationSettings(ctx.supabase, parsed.data.organizationId, {
    campaign_id: parsed.data.campaignId,
    automation_enabled: parsed.data.automation_enabled,
    auto_generate_content_drafts: parsed.data.auto_generate_content_drafts,
    auto_run_analyst_weekly: parsed.data.auto_run_analyst_weekly,
    require_approval_before_publish: parsed.data.require_approval_before_publish,
    require_approval_before_email: parsed.data.require_approval_before_email,
    auto_log_analytics_reviews: parsed.data.auto_log_analytics_reviews,
    max_runs_per_day: parsed.data.max_runs_per_day,
  });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: ctx.user.id,
    action: "settings.updated",
    entityType: "campaign",
    entityId: parsed.data.campaignId,
    metadata: { area: "campaign_automation", ...parsed.data },
  });

  return NextResponse.json({ ok: true, settings: row });
}

