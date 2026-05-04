import { NextResponse } from "next/server";
import { after } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { setCurrentOrgIdCookie } from "@/lib/cookies";
import { getSupabaseAdminConfigError } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/services/auth/authService";
import { beginMarketingPipelineRun, runMarketingPipeline } from "@/services/marketing-pipeline/runMarketingPipeline";
import { runMarketingPipelineInputSchema } from "@/services/marketing-pipeline/types";
import type { RunMarketingPipelineInput } from "@/services/marketing-pipeline/types";

const bodySchema = runMarketingPipelineInputSchema.extend({
  async: z.boolean().optional().default(true),
});

declare global {
  // eslint-disable-next-line no-var
  var __aiworkersMarketingPipelineJobs: Map<string, Promise<unknown>> | undefined;
}

function jobs() {
  if (!globalThis.__aiworkersMarketingPipelineJobs) globalThis.__aiworkersMarketingPipelineJobs = new Map();
  return globalThis.__aiworkersMarketingPipelineJobs;
}

export async function POST(request: Request) {
  try {
    const raw = await request.json().catch(() => null);
    const json =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (() => {
            // Back-compat: some older clients used `traffic` instead of `trafficSource`.
            const o = { ...(raw as Record<string, unknown>) };
            if (typeof o.trafficSource !== "string" && typeof o.traffic === "string") o.trafficSource = o.traffic;
            // Back-compat: default org mode if only org id is provided.
            if (typeof o.organizationMode !== "string" && typeof o.organizationId === "string") o.organizationMode = "existing";
            return o;
          })()
        : raw;

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Invalid body", issues: parsed.error.flatten() }, { status: 400 });
    }

    const { user, error: authError } = await getAuthedUser();
    if (authError || !user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    // Organization access
    if (parsed.data.organizationMode === "existing") {
      const organizationId = parsed.data.organizationId ?? "";
      if (!organizationId) return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
      const orgCtx = await withOrgOperator(organizationId);
      if (orgCtx.error) return orgCtx.error;
    }

    const adminCfgErr = getSupabaseAdminConfigError();
    if (adminCfgErr) {
      return NextResponse.json({ ok: false, message: adminCfgErr }, { status: 503 });
    }

    const supabase = await createSupabaseServerClient();

    const deferred = Boolean(parsed.data.defer) && Boolean(parsed.data.async);
    if (deferred) {
      const begin = await beginMarketingPipelineRun({
        supabase,
        actorUserId: user.id,
        input: parsed.data,
      });
      await setCurrentOrgIdCookie(begin.organizationId);

      after(async () => {
        try {
          const out = await runMarketingPipeline({
            supabase,
            actorUserId: user.id,
            input: {
              resumePipelineRunId: begin.pipelineRunId,
              organizationMode: "existing",
              organizationId: begin.organizationId,
            } as RunMarketingPipelineInput,
          });
          jobs().set(out.pipelineRunId, Promise.resolve(out));
        } catch (e) {
          console.error("[marketing-pipeline] deferred execution failed", e);
        }
      });

      const stages = begin.stages;
      return NextResponse.json({
        ok: true,
        async: true,
        deferred: true,
        queued: true,
        organizationId: begin.organizationId,
        campaignId: null,
        pipelineRunId: begin.pipelineRunId,
        stages: {
          research: { stageId: stages.research.id, status: stages.research.status },
          strategy: { stageId: stages.strategy.id, status: stages.strategy.status },
          creation: { stageId: stages.creation.id, status: stages.creation.status },
          execution: { stageId: stages.execution.id, status: stages.execution.status },
          optimization: { stageId: stages.optimization.id, status: stages.optimization.status },
        },
        createdRecords: [],
        approvalItems: [],
        logs: [],
        warnings: [],
        errors: [],
      });
    }

    // Kick off pipeline (blocking until completion)
    const runner = runMarketingPipeline({
      supabase,
      actorUserId: user.id,
      input: parsed.data,
    });

    if (parsed.data.async) {
      void runner.then((out) => {
        jobs().set(out.pipelineRunId, Promise.resolve(out));
      });
      const out = await runner;
      jobs().set(out.pipelineRunId, Promise.resolve(out));
      await setCurrentOrgIdCookie(out.organizationId);
      return NextResponse.json({ ok: true, async: true, ...out });
    }

    const out = await runner;
    await setCurrentOrgIdCookie(out.organizationId);
    return NextResponse.json({ ok: out.errors.length === 0, async: false, ...out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Pipeline failed";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}

