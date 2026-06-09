import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { runMarketingPipeline } from "@/services/marketing-pipeline/runMarketingPipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  runId: z.string().uuid(),
});

/** Long-running pipeline worker (up to 5 min). Used as fallback when background scheduling stalls. */
export async function POST(request: Request) {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) return NextResponse.json({ ok: false, message: "No organization selected" }, { status: 401 });

  const orgCtx = await withOrgMember(orgId);
  if (orgCtx.error) return orgCtx.error;

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("marketing_pipeline_runs" as never)
    .select("status")
    .eq("id", parsed.data.runId)
    .eq("organization_id", orgId)
    .maybeSingle();
  const status = String((row as { status?: string } | null)?.status ?? "");
  if (status === "completed" || status === "needs_approval") {
    return NextResponse.json({ ok: true, runId: parsed.data.runId, status: "already_done" });
  }

  try {
    const out = await runMarketingPipeline({
      supabase: orgCtx.supabase,
      actorUserId: orgCtx.user.id,
      input: {
        organizationMode: "existing",
        organizationId: orgId,
        resumePipelineRunId: parsed.data.runId,
      } as never,
    });
    return NextResponse.json({
      ok: out.errors.length === 0,
      runId: parsed.data.runId,
      campaignId: out.campaignId,
      status: out.errors.length ? "failed" : "completed",
      errors: out.errors,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Pipeline failed";
    return NextResponse.json({ ok: false, message: msg, runId: parsed.data.runId }, { status: 500 });
  }
}
