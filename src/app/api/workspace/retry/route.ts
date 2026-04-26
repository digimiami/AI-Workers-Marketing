import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executePendingRun } from "@/services/openclaw/orchestrationService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  section: z.enum(["content", "email", "funnel", "workers", "approvals"]),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  // Find the newest stub run matching the section and execute it; if missing, return 404.
  const { data: runs, error } = await admin
    .from("agent_runs" as never)
    .select("id,input,agents(key)")
    .eq("organization_id", parsed.data.organizationId)
    .eq("campaign_id", parsed.data.campaignId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const sectionKey =
    parsed.data.section === "content"
      ? "content_strategist"
      : parsed.data.section === "email"
        ? "lead_nurture_worker"
        : parsed.data.section === "funnel"
          ? "funnel_architect"
          : parsed.data.section === "workers"
            ? "campaign_launcher"
            : "analyst_worker";

  const match = (runs ?? []).find((r: any) => String(r?.agents?.key ?? "") === sectionKey);
  if (!match) return NextResponse.json({ ok: false, message: "No matching run found" }, { status: 404 });

  await executePendingRun(admin as any, {
    organizationId: parsed.data.organizationId,
    runId: (match as any).id,
    actorUserId: orgCtx.user.id,
  });

  return NextResponse.json({ ok: true });
}

