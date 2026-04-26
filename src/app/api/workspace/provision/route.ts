import { NextResponse } from "next/server";

import { z } from "zod";

import { setCurrentOrgIdCookie } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/services/auth/authService";
import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { provisionAiWorkersWorkspace, provisionAiWorkersWorkspaceInputSchema } from "@/services/workspace/provisionAiWorkersWorkspace";

const bodySchema = provisionAiWorkersWorkspaceInputSchema;

const newOrgSchema = z.object({
  organizationName: z.string().min(2),
});

async function upsertLauncherAgent(organizationId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("agents" as never)
    .upsert(
      {
        organization_id: organizationId,
        key: "campaign_launcher",
        name: "Campaign Launcher",
        description: "Workspace provisioning + campaign drafts via internal tools.",
        status: "enabled",
        approval_required: false,
        allowed_tools: [],
        input_schema: {},
        output_schema: {},
      } as never,
      { onConflict: "organization_id,key" },
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create agent");
  return (data as { id: string }).id;
}

async function insertRunLog(params: {
  organizationId: string;
  runId: string;
  level: "info" | "error";
  message: string;
  data?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  await admin.from("agent_logs" as never).insert({
    organization_id: params.organizationId,
    run_id: params.runId,
    level: params.level,
    message: params.message,
    data: params.data ?? {},
  } as never);
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  let organizationId = "";
  let createdNewOrganization = false;

  if (parsed.data.organizationMode === "create") {
    const ok = newOrgSchema.safeParse({ organizationName: parsed.data.organizationName });
    if (!ok.success) {
      return NextResponse.json({ ok: false, message: "organizationName required" }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const slug = ok.data.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "org";
    const { data: org, error } = await supabase.rpc("create_organization_with_owner" as never, {
      org_name: ok.data.organizationName,
      org_slug: slug,
    } as never);
    if (error || !org) {
      return NextResponse.json({ ok: false, message: error?.message ?? "Failed to create organization" }, { status: 400 });
    }
    organizationId = (org as { id: string }).id;
    createdNewOrganization = true;
    await setCurrentOrgIdCookie(organizationId);
  } else {
    if (!parsed.data.organizationId) {
      return NextResponse.json({ ok: false, message: "organizationId required for existing mode" }, { status: 400 });
    }
    organizationId = parsed.data.organizationId;
  }

  const orgCtx = await withOrgOperator(organizationId);
  if (orgCtx.error) return orgCtx.error;

  const traceId = `trace_${crypto.randomUUID()}`;
  const launcherAgentId = await upsertLauncherAgent(organizationId);
  const admin = createSupabaseAdminClient();

  const { data: run, error: runErr } = await admin
    .from("agent_runs" as never)
    .insert({
      organization_id: organizationId,
      agent_id: launcherAgentId,
      campaign_id: null,
      status: "running",
      input: { trace_id: traceId, role_mode: "workspace_orchestrator", workspace: parsed.data },
      started_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  if (runErr || !run) return NextResponse.json({ ok: false, message: runErr?.message ?? "Failed to create run" }, { status: 500 });
  const masterRunId = (run as { id: string }).id;

  await insertRunLog({ organizationId, runId: masterRunId, level: "info", message: "provisionAiWorkersWorkspace started", data: { traceId } });

  const output = await provisionAiWorkersWorkspace({
    actorUserId: user.id,
    organizationId,
    launcherAgentId,
    masterRunId,
    traceId,
    input: parsed.data,
  });

  const provisionFailed = output.errors.length > 0;
  await admin
    .from("agent_runs" as never)
    .update({
      status: provisionFailed ? "failed" : "success",
      finished_at: new Date().toISOString(),
      output_summary: provisionFailed ? `Provisioning finished with errors` : `Workspace provisioned`,
      error_message: provisionFailed ? output.errors.join("; ") : null,
      campaign_id: output.campaignId,
    } as never)
    .eq("organization_id", organizationId)
    .eq("id", masterRunId);

  await insertRunLog({
    organizationId,
    runId: masterRunId,
    level: provisionFailed ? "error" : "info",
    message: provisionFailed ? "Provisioning completed with errors" : "Provisioning completed",
    data: { campaignId: output.campaignId, funnelId: output.funnelId, errors: output.errors },
  });

  return NextResponse.json({
    ok: !provisionFailed,
    createdNewOrganization,
    traceId,
    masterRunId,
    ...output,
  });
}

