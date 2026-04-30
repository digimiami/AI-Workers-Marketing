import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { setCurrentOrgIdCookie } from "@/lib/cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/services/auth/authService";
import { runMarketingPipeline } from "@/services/marketing-pipeline/runMarketingPipeline";
import { runMarketingPipelineInputSchema } from "@/services/marketing-pipeline/types";

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
  const json = await request.json().catch(() => null);
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

  const supabase = await createSupabaseServerClient();

  // Kick off pipeline
  const runner = runMarketingPipeline({
    supabase,
    actorUserId: user.id,
    input: parsed.data,
  });

  if (parsed.data.async) {
    // Best-effort async runner: works reliably in dev/long-lived Node; may run inline on some serverless targets.
    void runner.then((out) => {
      jobs().set(out.pipelineRunId, Promise.resolve(out));
    });
    // We still want to return ids quickly; create a tiny run synchronously is done inside runMarketingPipeline.
    const out = await runner;
    jobs().set(out.pipelineRunId, Promise.resolve(out));
    await setCurrentOrgIdCookie(out.organizationId);
    return NextResponse.json({ ok: true, async: true, ...out });
  }

  const out = await runner;
  await setCurrentOrgIdCookie(out.organizationId);
  return NextResponse.json({ ok: out.errors.length === 0, async: false, ...out });
}

