import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runMarketingPipeline } from "@/services/marketing-pipeline/runMarketingPipeline";
import { marketingPipelineStageKeySchema, runMarketingPipelineInputSchema } from "@/services/marketing-pipeline/types";

const paramsSchema = z.object({
  runId: z.string().uuid(),
  stageKey: marketingPipelineStageKeySchema,
});

const bodySchema = z.object({
  action: z.enum(["rerun", "regenerate", "advance"]),
  async: z.boolean().optional().default(true),
});

const stageOrder = ["research", "strategy", "creation", "execution", "optimization"] as const;

export async function POST(request: Request, ctx: { params: Promise<{ runId: string; stageKey: string }> }) {
  const params = await ctx.params;
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, message: "Invalid params" }, { status: 400 });
  }
  const json = await request.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", issues: parsedBody.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: run, error: runErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .select("id,organization_id,campaign_id,input")
    .eq("id", parsedParams.data.runId)
    .maybeSingle();
  if (runErr) return NextResponse.json({ ok: false, message: runErr.message }, { status: 500 });
  if (!run) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  const organizationId = String((run as any).organization_id);
  const campaignId = (run as any).campaign_id ? String((run as any).campaign_id) : null;

  const orgCtx = await withOrgOperator(organizationId);
  if (orgCtx.error) return orgCtx.error;

  const baseInput = ((run as any).input ?? {}) as Record<string, unknown>;
  const stageKey = parsedParams.data.stageKey;

  let startStage = stageKey;
  let stopAfterStage: (typeof stageOrder)[number] | null = null;
  if (parsedBody.data.action === "regenerate") stopAfterStage = stageKey;
  if (parsedBody.data.action === "advance") {
    const idx = stageOrder.indexOf(stageKey as any);
    if (idx < 0 || idx === stageOrder.length - 1) {
      return NextResponse.json({ ok: false, message: "Cannot advance past last stage" }, { status: 400 });
    }
    startStage = stageOrder[idx + 1] as any;
  }

  const nextInput = {
    ...baseInput,
    organizationMode: "existing",
    organizationId,
    campaignId,
    startStage,
    stopAfterStage,
  };
  const validated = runMarketingPipelineInputSchema.safeParse(nextInput);
  if (!validated.success) {
    return NextResponse.json({ ok: false, message: "Invalid stored run input", issues: validated.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const runner = runMarketingPipeline({
    supabase,
    actorUserId: orgCtx.user.id,
    input: validated.data,
  });

  if (parsedBody.data.async) {
    const out = await runner;
    return NextResponse.json({ ok: true, async: true, ...out });
  }

  const out = await runner;
  return NextResponse.json({ ok: out.errors.length === 0, async: false, ...out });
}

