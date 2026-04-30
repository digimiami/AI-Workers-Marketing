import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({ campaignId: z.string().uuid() });

export async function GET(_request: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const params = await ctx.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid campaignId" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: campaign, error: cErr } = await admin
    .from("campaigns" as never)
    .select("id,organization_id,name,status,created_at")
    .eq("id", parsed.data.campaignId)
    .maybeSingle();
  if (cErr) return NextResponse.json({ ok: false, message: cErr.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  const orgCtx = await withOrgMember(String((campaign as any).organization_id));
  if (orgCtx.error) return orgCtx.error;

  const { data: runs, error: rErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .select("id,status,provider,approval_mode,current_stage,started_at,finished_at,created_at,updated_at,errors,warnings")
    .eq("campaign_id", parsed.data.campaignId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (rErr) return NextResponse.json({ ok: false, message: rErr.message }, { status: 500 });

  const run0 = (runs as any[] | null | undefined)?.[0];
  const latestRunId = run0?.id ? String(run0.id) : null;

  return NextResponse.json({ ok: true, campaign, runs: runs ?? [], latestRunId });
}

