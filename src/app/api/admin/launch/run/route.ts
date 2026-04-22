import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { setCurrentOrgIdCookie } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/services/auth/authService";
import {
  executeWorkspaceProvisioning,
  type WorkspaceProvisionInput,
} from "@/services/workspace/workspaceProvisioningService";

const slugSchema = z
  .string()
  .min(2)
  .regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, and dashes only.");

const newOrgSchema = z.object({
  name: z.string().min(2),
  slug: slugSchema,
});

const bodySchema = z
  .object({
    organizationId: z.string().uuid().optional(),
    createNewOrganization: newOrgSchema.optional(),
    selectedOrganizationId: z.string().uuid().optional(),
    mode: z.enum(["affiliate", "client"]).default("affiliate"),
    affiliate_link: z.string().url().optional(),
    niche: z.string().min(2),
    target_audience: z.string().min(2),
    traffic_source: z.string().min(2),
    campaign_goal: z.string().optional(),
    client_business_name: z.string().optional(),
    client_offer_url: z.string().url().optional(),
    client_service_goal: z.string().optional(),
    notes: z.string().optional(),
    dev_seed: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "affiliate") {
      if (!data.affiliate_link) {
        ctx.addIssue({ code: "custom", message: "affiliate_link required for affiliate mode", path: ["affiliate_link"] });
      }
      if (!data.campaign_goal || data.campaign_goal.length < 2) {
        ctx.addIssue({ code: "custom", message: "campaign_goal required", path: ["campaign_goal"] });
      }
    }
    if (data.mode === "client") {
      if (!data.client_business_name || data.client_business_name.length < 2) {
        ctx.addIssue({ code: "custom", message: "client_business_name required", path: ["client_business_name"] });
      }
      if (!data.client_offer_url) {
        ctx.addIssue({ code: "custom", message: "client_offer_url required", path: ["client_offer_url"] });
      }
      if (!data.client_service_goal || data.client_service_goal.length < 2) {
        ctx.addIssue({ code: "custom", message: "client_service_goal required", path: ["client_service_goal"] });
      }
    }
    const hasNew = Boolean(data.createNewOrganization);
    const hasSelected = Boolean(data.selectedOrganizationId);
    const hasLegacy = Boolean(data.organizationId);
    if (!hasNew && !hasSelected && !hasLegacy) {
      ctx.addIssue({
        code: "custom",
        message: "Provide organizationId, selectedOrganizationId, or createNewOrganization",
        path: ["organizationId"],
      });
    }
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
  if (authError || !user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let organizationId = "";
  let createdNewOrganization = false;

  if (parsed.data.createNewOrganization) {
    const supabase = await createSupabaseServerClient();
    const { data: org, error } = await supabase.rpc("create_organization_with_owner" as never, {
      org_name: parsed.data.createNewOrganization.name,
      org_slug: parsed.data.createNewOrganization.slug,
    } as never);
    if (error || !org) {
      return NextResponse.json(
        { ok: false, message: error?.message ?? "Failed to create organization (is RPC migration applied?)" },
        { status: 400 },
      );
    }
    organizationId = (org as { id: string }).id;
    createdNewOrganization = true;
    await setCurrentOrgIdCookie(organizationId);
  } else {
    organizationId =
      parsed.data.selectedOrganizationId ?? parsed.data.organizationId ?? "";
  }

  if (!organizationId) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(organizationId);
  if (orgCtx.error) return orgCtx.error;

  const traceId = `trace_${crypto.randomUUID()}`;
  const admin = createSupabaseAdminClient();

  const provisionInput: WorkspaceProvisionInput = {
    mode: parsed.data.mode,
    niche: parsed.data.niche,
    target_audience: parsed.data.target_audience,
    traffic_source: parsed.data.traffic_source,
    notes: parsed.data.notes,
    affiliate_link: parsed.data.affiliate_link,
    campaign_goal: parsed.data.campaign_goal,
    client_business_name: parsed.data.client_business_name,
    client_offer_url: parsed.data.client_offer_url,
    client_service_goal: parsed.data.client_service_goal,
  };

  let runId = "";
  try {
    const agentId = await upsertLauncherAgent(organizationId);

    const { data: run, error: runErr } = await admin
      .from("agent_runs" as never)
      .insert({
        organization_id: organizationId,
        agent_id: agentId,
        campaign_id: null,
        status: "running",
        input: {
          trace_id: traceId,
          role_mode: "workspace_orchestrator",
          workspace: provisionInput,
          dev_seed: parsed.data.dev_seed ?? false,
        },
        started_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();
    if (runErr || !run) throw new Error(runErr?.message ?? "Failed to create run");
    runId = (run as { id: string }).id;

    await insertRunLog({
      organizationId,
      runId,
      level: "info",
      message: "Workspace orchestrator started",
      data: { traceId, mode: provisionInput.mode },
    });

    const review = await executeWorkspaceProvisioning({
      admin,
      organizationId,
      actorUserId: orgCtx.user.id,
      launcherAgentId: agentId,
      runId,
      traceId,
      input: provisionInput,
      devSeedRequested: Boolean(parsed.data.dev_seed),
    });

    const provisionFailed = review.errors.length > 0;

    // Merge classic launcher review keys for approve/regenerate compatibility
    const launchReview = {
      ...review,
      traceId: review.traceId,
      notes: review.notes,
    };

    await admin.from("agent_outputs" as never).insert({
      organization_id: organizationId,
      run_id: runId,
      output_type: "launch.review",
      content: launchReview,
    } as never);

    await admin
      .from("agent_runs" as never)
      .update({
        status: provisionFailed ? "failed" : "success",
        finished_at: new Date().toISOString(),
        output_summary: provisionFailed
          ? `Workspace provisioning partial/failed: ${review.errors[0]?.slice(0, 120) ?? "error"}`
          : `Workspace provisioned: ${review.campaign?.name ?? "campaign"}`,
        error_message: provisionFailed ? review.errors.join("; ") : null,
      } as never)
      .eq("organization_id", organizationId)
      .eq("id", runId);

    await insertRunLog({
      organizationId,
      runId,
      level: provisionFailed ? "error" : "info",
      message: provisionFailed
        ? "Workspace orchestrator finished with errors (prior steps kept)"
        : "Workspace orchestrator finished",
      data: {
        campaignId: review.campaign?.id,
        funnelId: review.funnel?.id,
        errors: review.errors,
      },
    });

    return NextResponse.json({
      ok: !provisionFailed,
      partial: provisionFailed,
      runId,
      traceId,
      organizationId,
      createdNewOrganization,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Provisioning failed";
    if (runId) {
      await insertRunLog({
        organizationId,
        runId,
        level: "error",
        message: "Workspace orchestrator failed",
        data: { error: msg },
      });
      await admin
        .from("agent_runs" as never)
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: msg,
        } as never)
        .eq("organization_id", organizationId)
        .eq("id", runId);
    }
    return NextResponse.json({ ok: false, message: msg, organizationId, runId: runId || undefined }, { status: 500 });
  }
}
