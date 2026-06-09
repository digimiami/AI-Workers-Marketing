import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { beginMarketingPipelineRun } from "@/services/marketing-pipeline/runMarketingPipeline";
import { liveWorkspaceBuildBodySchema } from "@/services/workspace/liveWorkspaceBuilder";
import { normalizeWorkspaceStreamUrl } from "@/services/workspace/workspaceRunSnapshot";
export const runtime = "nodejs";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function POST(request: Request) {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) return NextResponse.json({ ok: false, message: "No organization selected" }, { status: 401 });

  const orgCtx = await withOrgMember(orgId);
  if (orgCtx.error) return orgCtx.error;

  const json = await request.json().catch(() => null);
  const parsed = liveWorkspaceBuildBodySchema.safeParse(asRecord(json));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.message }, { status: 400 });
  }

  if (parsed.data.runId) {
    return NextResponse.json({ ok: true, runId: parsed.data.runId });
  }

  const normalized = {
    ...parsed.data,
    url: parsed.data.url ? normalizeWorkspaceStreamUrl(parsed.data.url) : parsed.data.url,
  };
  const required = z
    .object({
      url: z.string().url(),
      goal: z.string().min(1),
      audience: z.string().min(1),
      trafficSource: z.string().min(1),
    })
    .safeParse(normalized);
  if (!required.success) {
    return NextResponse.json({ ok: false, message: "Invalid build params" }, { status: 400 });
  }

  const begin = await beginMarketingPipelineRun({
    supabase: orgCtx.supabase,
    actorUserId: orgCtx.user.id,
    input: {
      organizationMode: "existing",
      organizationId: orgId,
      campaignId: undefined,
      url: required.data.url,
      mode: parsed.data.mode ?? "affiliate",
      goal: required.data.goal,
      audience: required.data.audience,
      trafficSource: required.data.trafficSource,
      funnelStyle: parsed.data.funnelStyle,
      provider: parsed.data.provider ?? "hybrid",
      approvalMode: parsed.data.approvalMode ?? "auto_draft",
      notes: null,
    } as never,
  });

  return NextResponse.json({ ok: true, runId: begin.pipelineRunId });
}
