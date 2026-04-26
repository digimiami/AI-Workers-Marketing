import { z } from "zod";

import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceProvisionInput } from "@/services/workspace/workspaceProvisioningService";
import { executeWorkspaceProvisioning } from "@/services/workspace/workspaceProvisioningService";
import { syncAgentsAndTemplates } from "@/services/openclaw/orchestrationService";

export const provisionAiWorkersWorkspaceInputSchema = z.object({
  mode: z.enum(["affiliate", "client"]),
  organizationMode: z.enum(["existing", "create"]),
  organizationId: z.string().uuid().optional(),
  organizationName: z.string().min(2).optional(),
  affiliateLink: z.string().url().optional(),
  clientWebsite: z.string().url().optional(),
  businessName: z.string().min(2).optional(),
  niche: z.string().min(2),
  audience: z.string().min(2),
  trafficSource: z.string().min(2),
  goal: z.string().min(2),
  notes: z.string().optional(),
  devSeedDemoData: z.boolean().optional(),
});

export type ProvisionAiWorkersWorkspaceInput = z.infer<typeof provisionAiWorkersWorkspaceInputSchema>;

export type ProvisionAiWorkersWorkspaceOutput = {
  organizationId: string;
  campaignId: string | null;
  funnelId: string | null;
  funnelStepIds: string[];
  contentAssetIds: string[];
  emailTemplateIds: string[];
  emailSequenceId: string | null;
  emailSequenceStepIds: string[];
  workerAssignmentIds: string[];
  masterAgentRunId: string;
  childAgentRunIds: string[];
  approvalIds: string[];
  trackingLinkIds: string[];
  analyticsSetup: Record<string, unknown>;
  settingsSetup: Record<string, unknown>;
  logIds: string[];
  warnings: string[];
  errors: string[];
};

async function toolOk<T>(body: unknown): Promise<T> {
  const res = await executeOpenClawTool(body);
  if (!res.success) throw new Error(`${res.error.code}: ${res.error.message}`);
  return res.data as T;
}

async function listCampaignAgents(admin: ReturnType<typeof createSupabaseAdminClient>, orgId: string, campaignId: string) {
  const { data, error } = await admin
    .from("campaign_agents" as never)
    .select("id,agent_id,agents(key)")
    .eq("organization_id", orgId)
    .eq("campaign_id", campaignId)
    .order("priority", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

async function ensureCounts(params: {
  organizationId: string;
  actorUserId: string;
  traceId: string;
  launcherAgentId: string;
  runId: string;
  campaignId: string;
  funnelId: string;
  destinationUrl: string;
  trafficSource: string;
  niche: string;
  audience: string;
  goal: string;
  wantContentAssets: number;
  wantEmailTemplates: number;
  wantWorkers: string[];
}) {
  const admin = createSupabaseAdminClient();

  // Content assets
  const { data: contentRows, error: cErr } = await admin
    .from("content_assets" as never)
    .select("id,title,status")
    .eq("organization_id", params.organizationId)
    .eq("campaign_id", params.campaignId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (cErr) throw new Error(cErr.message);
  const contentAssetIds = (contentRows ?? []).map((r: any) => String(r.id));
  const missingContent = Math.max(0, params.wantContentAssets - contentAssetIds.length);
  if (missingContent > 0) {
    for (let i = 0; i < missingContent; i += 1) {
      const title = `Short-form script ${contentAssetIds.length + i + 1} · ${params.niche}`;
      const created = await toolOk<any>({
        organization_id: params.organizationId,
        trace_id: params.traceId,
        role_mode: "campaign_launcher",
        approval_mode: "auto",
        actor: { type: "user", user_id: params.actorUserId },
        campaign_id: params.campaignId,
        agent_id: params.launcherAgentId,
        run_id: params.runId,
        tool_name: "create_content_asset",
        input: {
          organizationId: params.organizationId,
          title,
          platform: params.trafficSource,
          status: "draft",
          campaign_id: params.campaignId,
          funnel_id: params.funnelId,
          hook: `Hook for ${params.audience}`,
          body: `Draft script (${i + 1}/${missingContent}) for ${params.goal}.`,
          metadata: { trace_id: params.traceId, kind: "short_form_script" },
        },
      });
      contentAssetIds.push(String(created.id));
    }
  }

  // Email templates + sequence steps
  const { data: templates, error: tErr } = await admin
    .from("email_templates" as never)
    .select("id,name,subject")
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (tErr) throw new Error(tErr.message);
  const emailTemplateIds = (templates ?? []).map((r: any) => String(r.id));
  const missingTemplates = Math.max(0, params.wantEmailTemplates - emailTemplateIds.length);
  if (missingTemplates > 0) {
    for (let i = 0; i < missingTemplates; i += 1) {
      const tpl = await toolOk<any>({
        organization_id: params.organizationId,
        trace_id: params.traceId,
        role_mode: "campaign_launcher",
        approval_mode: "auto",
        actor: { type: "user", user_id: params.actorUserId },
        campaign_id: params.campaignId,
        agent_id: params.launcherAgentId,
        run_id: params.runId,
        tool_name: "create_email_template",
        input: {
          organizationId: params.organizationId,
          name: `Nurture ${emailTemplateIds.length + i + 1} · ${params.niche}`.slice(0, 120),
          subject: `Step ${emailTemplateIds.length + i + 1}: ${params.niche}`.slice(0, 120),
          body_markdown: `Draft nurture email.\n\nGoal: ${params.goal}\nTraffic: ${params.trafficSource}\nCTA: ${params.destinationUrl}`,
          status: "draft",
        },
      });
      emailTemplateIds.push(String(tpl.id));
    }
  }

  // Workers (campaign_agents)
  await syncAgentsAndTemplates(admin as any, params.organizationId);
  const assigned = await listCampaignAgents(admin, params.organizationId, params.campaignId);
  const assignedKeys = new Set<string>(assigned.map((r) => String((r as any)?.agents?.key ?? "")));
  for (const key of params.wantWorkers) {
    if (assignedKeys.has(key)) continue;
    // find agent id
    const { data: agent, error: aErr } = await admin
      .from("agents" as never)
      .select("id")
      .eq("organization_id", params.organizationId)
      .eq("key", key)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!agent) continue;
    const { data: row, error: caErr } = await admin
      .from("campaign_agents" as never)
      .upsert(
        {
          organization_id: params.organizationId,
          campaign_id: params.campaignId,
          agent_id: (agent as any).id,
          priority: key === "campaign_launcher" ? 0 : 10,
          config: { workspace_trace: params.traceId, mode: params.trafficSource },
        } as never,
        { onConflict: "campaign_id,agent_id" },
      )
      .select("id")
      .single();
    if (caErr) throw new Error(caErr.message);
    assigned.push(row as any);
  }

  return {
    contentAssetIds,
    emailTemplateIds,
    workerAssignmentIds: assigned.map((r) => String(r.id)).filter(Boolean),
  };
}

/**
 * Master backend orchestrator: provisions the AiWorkers “Single Brain OS” workspace.
 *
 * This intentionally persists real records (campaign/funnel/steps/content/email/workers/runs/approvals/tracking/events/logs),
 * but keeps external publishing/sending gated via approvals.
 */
export async function provisionAiWorkersWorkspace(params: {
  actorUserId: string;
  organizationId: string;
  launcherAgentId: string;
  masterRunId: string;
  traceId: string;
  input: ProvisionAiWorkersWorkspaceInput;
}): Promise<ProvisionAiWorkersWorkspaceOutput> {
  const admin = createSupabaseAdminClient();

  // Map requested input to existing provisioning input
  const destinationUrl =
    params.input.mode === "affiliate"
      ? String(params.input.affiliateLink ?? "")
      : String(params.input.clientWebsite ?? params.input.affiliateLink ?? "");

  const provisionInput: WorkspaceProvisionInput = {
    mode: params.input.mode,
    niche: params.input.niche,
    target_audience: params.input.audience,
    traffic_source: params.input.trafficSource,
    notes: params.input.notes,
    affiliate_link: params.input.mode === "affiliate" ? params.input.affiliateLink : undefined,
    campaign_goal: params.input.goal,
    client_business_name: params.input.businessName,
    client_offer_url: params.input.clientWebsite,
    client_service_goal: params.input.goal,
  };

  // WorkspaceProvisioning already creates most records; we extend it to satisfy required counts + worker set.
  const review = await executeWorkspaceProvisioning({
    admin: admin as any,
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    launcherAgentId: params.launcherAgentId,
    runId: params.masterRunId,
    traceId: params.traceId,
    input: provisionInput,
    devSeedRequested: Boolean(params.input.devSeedDemoData),
  });

  const campaignId = review.campaign?.id ?? null;
  const funnelId = review.funnel?.id ?? null;
  const funnelStepIds = (review.funnel_steps ?? []).map((s) => s.id);
  const approvalIds = (review.approval_items ?? []).map((a) => a.id);
  const contentAssetIdsInitial = (review.content_assets ?? []).map((a) => a.id);
  const emailTemplateIdsInitial = (review.email?.templates ?? []).map((t) => t.id);
  const emailSequenceId = review.email?.sequence?.id ?? null;

  // If base provisioning failed, return a structured result without destroying anything.
  if (!campaignId || !funnelId || review.errors.length > 0) {
    return {
      organizationId: params.organizationId,
      campaignId,
      funnelId,
      funnelStepIds,
      contentAssetIds: contentAssetIdsInitial,
      emailTemplateIds: emailTemplateIdsInitial,
      emailSequenceId,
      emailSequenceStepIds: [],
      workerAssignmentIds: [],
      masterAgentRunId: params.masterRunId,
      childAgentRunIds: (review.child_runs ?? []).map((r) => r.id),
      approvalIds,
      trackingLinkIds: review.tracking?.link?.id ? [review.tracking.link.id] : [],
      analyticsSetup: review.analytics ?? {},
      settingsSetup: { settings_keys_initialized: review.settings_keys_initialized ?? [] },
      logIds: [],
      warnings: review.warnings ?? [],
      errors: review.errors ?? [],
    };
  }

  const wantWorkers = [
    "campaign_launcher",
    "offer_analyst",
    "funnel_architect",
    "content_strategist",
    "lead_nurture_worker",
    "analyst_worker",
    "opportunity_scout",
    "publishing_worker",
  ];

  const ensured = await ensureCounts({
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    traceId: params.traceId,
    launcherAgentId: params.launcherAgentId,
    runId: params.masterRunId,
    campaignId,
    funnelId,
    destinationUrl,
    trafficSource: params.input.trafficSource,
    niche: params.input.niche,
    audience: params.input.audience,
    goal: params.input.goal,
    wantContentAssets: 10,
    wantEmailTemplates: 5,
    wantWorkers,
  });

  // Ensure sequence has steps attached to templates (at least 5)
  const emailSequenceStepIds: string[] = [];
  if (emailSequenceId) {
    const { data: steps, error: sErr } = await admin
      .from("email_sequence_steps" as never)
      .select("id,step_index,template_id")
      .eq("organization_id", params.organizationId)
      .eq("sequence_id", emailSequenceId)
      .order("step_index", { ascending: true })
      .limit(200);
    if (sErr) throw new Error(sErr.message);
    for (const s of steps ?? []) emailSequenceStepIds.push(String((s as any).id));

    const wantSteps = Math.min(5, ensured.emailTemplateIds.length);
    if (emailSequenceStepIds.length < wantSteps) {
      for (let i = emailSequenceStepIds.length; i < wantSteps; i += 1) {
        const tplId = ensured.emailTemplateIds[i];
        const step = await toolOk<any>({
          organization_id: params.organizationId,
          trace_id: params.traceId,
          role_mode: "campaign_launcher",
          approval_mode: "auto",
          actor: { type: "user", user_id: params.actorUserId },
          campaign_id: campaignId,
          agent_id: params.launcherAgentId,
          run_id: params.masterRunId,
          tool_name: "add_email_sequence_step",
          input: { organizationId: params.organizationId, sequence_id: emailSequenceId, template_id: tplId, delay_minutes: i * 60 * 24 },
        });
        emailSequenceStepIds.push(String(step.id));
      }
    }
  }

  // Child runs: create stubs for each “default worker” if missing.
  const childAgentRunIds: string[] = [];
  const { data: agentRuns } = await admin
    .from("agent_runs" as never)
    .select("id,input")
    .eq("organization_id", params.organizationId)
    .eq("campaign_id", campaignId)
    .limit(200);
  const existingPurposes = new Set<string>(
    (agentRuns ?? []).map((r: any) => String(r?.input?.purpose ?? "")).filter(Boolean),
  );
  for (const key of [
    "offer_analyst",
    "funnel_architect",
    "content_strategist",
    "lead_nurture_worker",
    "analyst_worker",
    "opportunity_scout",
    "publishing_worker",
  ]) {
    const purpose = `post_provision_${key}`;
    if (existingPurposes.has(purpose)) continue;
    const { data: agent } = await admin
      .from("agents" as never)
      .select("id")
      .eq("organization_id", params.organizationId)
      .eq("key", key)
      .maybeSingle();
    if (!agent) continue;
    const cr = await toolOk<any>({
      organization_id: params.organizationId,
      trace_id: `trace_${crypto.randomUUID()}`,
      role_mode: "campaign_launcher",
      approval_mode: "disabled",
      actor: { type: "user", user_id: params.actorUserId },
      campaign_id: campaignId,
      agent_id: (agent as any).id,
      run_id: params.masterRunId,
      tool_name: "create_agent_run",
      input: { organizationId: params.organizationId, agent_id: (agent as any).id, campaign_id: campaignId, actor_user_id: params.actorUserId, input: { parent_run_id: params.masterRunId, trace_id: params.traceId, purpose, stub: true } },
    });
    childAgentRunIds.push(String(cr.id));
  }

  // Tracking link ids
  const trackingLinkIds: string[] = [];
  if (review.tracking?.link?.id) trackingLinkIds.push(review.tracking.link.id);

  // Log ids: we can at least return agent_log ids for the master run.
  const { data: logs, error: lErr } = await admin
    .from("agent_logs" as never)
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("run_id", params.masterRunId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (lErr) throw new Error(lErr.message);
  const logIds = (logs ?? []).map((r: any) => String(r.id));

  // Settings setup summary (from review)
  const settingsSetup = {
    settings_keys_initialized: review.settings_keys_initialized ?? [],
    integration_stub: review.integration_stub ?? {},
    dev_seeded: Boolean(review.dev_seeded),
  };

  return {
    organizationId: params.organizationId,
    campaignId,
    funnelId,
    funnelStepIds,
    contentAssetIds: ensured.contentAssetIds,
    emailTemplateIds: ensured.emailTemplateIds,
    emailSequenceId,
    emailSequenceStepIds,
    workerAssignmentIds: ensured.workerAssignmentIds,
    masterAgentRunId: params.masterRunId,
    childAgentRunIds: [...new Set([...(review.child_runs ?? []).map((r) => r.id), ...childAgentRunIds])],
    approvalIds,
    trackingLinkIds,
    analyticsSetup: review.analytics ?? { baseline_logged: false },
    settingsSetup,
    logIds,
    warnings: review.warnings ?? [],
    errors: review.errors ?? [],
  };
}

