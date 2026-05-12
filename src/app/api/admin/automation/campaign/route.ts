import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient, getSupabaseAdminConfigError } from "@/lib/supabase/admin";
import {
  getCampaignAutomationSettings,
  upsertCampaignAutomationSettings,
} from "@/services/automation/automationService";
import { writeAuditLog } from "@/services/audit/auditService";

function isCampaignAutomationTableMissing(message: string): boolean {
  const lower = message.toLowerCase();
  if (!lower.includes("campaign_automation_settings")) return false;
  return (
    lower.includes("schema cache") ||
    lower.includes("does not exist") ||
    lower.includes("could not find the table")
  );
}

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

  try {
    const settings = await getCampaignAutomationSettings(ctx.supabase, parsedOrg.data, parsedCampaign.data);
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Safe fallback: UI can still render defaults even if automation tables aren't migrated yet.
    return NextResponse.json(
      { ok: true, settings: null, warning: msg },
      { status: 200 },
    );
  }
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

  const { data: campaignRow, error: campaignErr } = await ctx.supabase
    .from("campaigns" as never)
    .select("id")
    .eq("id", parsed.data.campaignId)
    .eq("organization_id", parsed.data.organizationId)
    .maybeSingle();

  if (campaignErr) {
    return NextResponse.json({ ok: false, message: campaignErr.message }, { status: 500 });
  }
  if (!campaignRow) {
    return NextResponse.json(
      { ok: false, message: "Campaign not found in this workspace." },
      { status: 404 },
    );
  }

  // Prefer service-role writes after explicit auth + campaign scoping so RLS/grant drift
  // on `campaign_automation_settings` cannot block operators (still tenant-safe).
  const writeDb = getSupabaseAdminConfigError() === null ? createSupabaseAdminClient() : ctx.supabase;

  let row: unknown = null;
  try {
    row = await upsertCampaignAutomationSettings(writeDb, parsed.data.organizationId, {
      campaign_id: parsed.data.campaignId,
      automation_enabled: parsed.data.automation_enabled,
      auto_generate_content_drafts: parsed.data.auto_generate_content_drafts,
      auto_run_analyst_weekly: parsed.data.auto_run_analyst_weekly,
      require_approval_before_publish: parsed.data.require_approval_before_publish,
      require_approval_before_email: parsed.data.require_approval_before_email,
      auto_log_analytics_reviews: parsed.data.auto_log_analytics_reviews,
      max_runs_per_day: parsed.data.max_runs_per_day,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isCampaignAutomationTableMissing(msg)) {
      return NextResponse.json(
        {
          ok: false,
          code: "AUTOMATION_SCHEMA_MISSING",
          message:
            "Automation tables are not on this Supabase project yet. In the Supabase dashboard run pending migrations (see repo supabase/migrations, especially campaign_automation_settings), or run `supabase db push` linked to production. Then wait a few seconds and retry.",
        },
        { status: 503 },
      );
    }
    const lower = msg.toLowerCase();
    const rls =
      lower.includes("row-level security") ||
      lower.includes("violates row-level security") ||
      lower.includes("permission denied");
    return NextResponse.json({ ok: false, message: msg }, { status: rls ? 403 : 500 });
  }

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

