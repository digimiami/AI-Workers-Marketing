import { NextResponse } from "next/server";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RunRow = {
  id: string;
  campaign_id: string | null;
  status: string;
  current_stage: string | null;
  input: unknown;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  campaigns?: { name: string } | null;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function previewFromInput(input: unknown): { url: string; goal: string } {
  const r = asRecord(input);
  const url = typeof r.url === "string" ? r.url : "";
  const goal = typeof r.goal === "string" ? r.goal : "";
  return { url, goal };
}

/** List marketing pipeline runs for the current org (from cookie). */
export async function GET() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) return NextResponse.json({ ok: false, message: "No organization selected" }, { status: 401 });

  const orgCtx = await withOrgMember(orgId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("marketing_pipeline_runs" as never)
    .select("id,campaign_id,status,current_stage,input,created_at,updated_at,finished_at,campaigns(name)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const rows = (Array.isArray(data) ? data : []) as RunRow[];
  const runs = rows.map((row) => {
    const camp = row.campaigns;
    const campaignName = camp && typeof camp === "object" && "name" in camp ? String((camp as { name?: string }).name ?? "") : "";
    return {
      id: row.id,
      campaignId: row.campaign_id,
      campaignName: campaignName || null,
      status: row.status,
      currentStage: row.current_stage,
      preview: previewFromInput(row.input),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      finishedAt: row.finished_at,
    };
  });

  return NextResponse.json({ ok: true, runs });
}
