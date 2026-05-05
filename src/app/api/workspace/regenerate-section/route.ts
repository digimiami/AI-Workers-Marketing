import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runMarketingPipeline } from "@/services/marketing-pipeline/runMarketingPipeline";
import { marketingPipelineStageKeySchema, runMarketingPipelineInputSchema } from "@/services/marketing-pipeline/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  runId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  section: z.enum(["research", "campaign", "landing", "funnel", "content", "ads", "emails"]),
});

function sectionToStage(section: z.infer<typeof bodySchema>["section"]): z.infer<typeof marketingPipelineStageKeySchema> {
  if (section === "research") return "research";
  if (section === "campaign") return "strategy";
  return "creation";
}

export async function POST(request: Request) {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) return NextResponse.json({ ok: false, message: "No organization selected" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: run, error: runErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .select("id,organization_id,campaign_id,input")
    .eq("id", parsed.data.runId)
    .maybeSingle();
  if (runErr) return NextResponse.json({ ok: false, message: runErr.message }, { status: 500 });
  if (!run) return NextResponse.json({ ok: false, message: "Run not found" }, { status: 404 });

  const organizationId = String((run as { organization_id: string }).organization_id);
  if (organizationId !== orgId) {
    return NextResponse.json({ ok: false, message: "Run does not belong to this organization" }, { status: 403 });
  }

  const orgCtx = await withOrgOperator(organizationId);
  if (orgCtx.error) return orgCtx.error;

  const campaignId =
    parsed.data.campaignId ??
    ((run as { campaign_id?: string | null }).campaign_id ? String((run as { campaign_id?: string | null }).campaign_id) : null);

  const baseInput = ((run as { input?: unknown }).input ?? {}) as Record<string, unknown>;
  const stageKey = sectionToStage(parsed.data.section);

  const nextInput = {
    ...baseInput,
    organizationMode: "existing",
    organizationId,
    campaignId,
    resumePipelineRunId: parsed.data.runId,
    startStage: stageKey,
    stopAfterStage: stageKey,
  };
  const validated = runMarketingPipelineInputSchema.safeParse(nextInput);
  if (!validated.success) {
    return NextResponse.json({ ok: false, message: "Invalid stored run input", issues: validated.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const out = await runMarketingPipeline({
    supabase,
    actorUserId: orgCtx.user.id,
    input: validated.data,
  });

  return NextResponse.json({
    ok: true,
    section: parsed.data.section,
    stageKey,
    pipelineRunId: out.pipelineRunId,
    campaignId: out.campaignId,
    errors: out.errors,
    warnings: out.warnings,
  });
}
