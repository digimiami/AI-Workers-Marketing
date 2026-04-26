import type { SupabaseClient } from "@supabase/supabase-js";

import { describeOpenClawBackend } from "@/lib/openclaw/factory";
import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";
import { env } from "@/lib/env";
import { getDefaultFeatureFlags } from "@/lib/featureFlags";
import { writeAuditLog } from "@/services/audit/auditService";
import { assignCampaignAgent, listAgents, syncAgentsAndTemplates } from "@/services/openclaw/orchestrationService";

export type WorkspaceProvisionMode = "affiliate" | "client";

export type WorkspaceProvisionInput = {
  mode: WorkspaceProvisionMode;
  niche: string;
  target_audience: string;
  traffic_source: string;
  notes?: string;
  affiliate_link?: string;
  campaign_goal?: string;
  client_business_name?: string;
  client_offer_url?: string;
  client_service_goal?: string;
};

export type WorkspaceProvisionProgressRow = {
  step: string;
  status: "ok" | "error" | "skipped";
  message?: string;
  at: string;
};

export type WorkspaceProvisionReview = {
  kind: "workspace";
  traceId: string;
  mode: WorkspaceProvisionMode;
  organization: { id: string };
  approvals: Record<string, boolean>;
  campaign?: { id: string; name: string };
  funnel?: { id: string; name: string };
  funnel_steps?: Array<{ id: string; name: string; step_type: string; slug: string }>;
  content_assets?: Array<{ id: string; title: string; status: string }>;
  email?: {
    sequence?: { id: string; name: string };
    templates?: Array<{ id: string; name: string; subject: string; status: string }>;
  };
  tracking?: { link?: { id: string; destination_url: string } };
  lead_system?: {
    settings_key: string;
    summary: string;
  };
  workers?: { assigned: Array<{ agent_key: string; id?: string }> };
  child_runs?: Array<{ id: string; agent_key: string }>;
  approval_items?: Array<{ id: string; approval_type: string }>;
  analytics?: { baseline_logged: boolean; event?: string };
  settings_keys_initialized?: string[];
  integration_stub?: Record<string, unknown>;
  progress: WorkspaceProvisionProgressRow[];
  warnings: string[];
  errors: string[];
  dev_seeded?: boolean;
  notes: string;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

async function mergeSettingJson(
  admin: SupabaseClient,
  organizationId: string,
  key: string,
  patch: Record<string, unknown>,
) {
  const { data: existing } = await admin
    .from("settings" as never)
    .select("value")
    .eq("organization_id", organizationId)
    .eq("key", key)
    .maybeSingle();
  const prev = ((existing as any)?.value ?? {}) as Record<string, unknown>;
  const next = { ...prev, ...patch };
  const { error } = await admin.from("settings" as never).upsert(
    {
      organization_id: organizationId,
      key,
      value: next,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "organization_id,key" },
  );
  if (error) throw new Error(error.message);
}

async function insertRunLog(admin: SupabaseClient, row: {
  organizationId: string;
  runId: string;
  level: "info" | "error";
  message: string;
  data?: Record<string, unknown>;
}) {
  await admin.from("agent_logs" as never).insert({
    organization_id: row.organizationId,
    run_id: row.runId,
    level: row.level,
    message: row.message,
    data: row.data ?? {},
  } as never);
}

function pushProgress(
  review: WorkspaceProvisionReview,
  step: string,
  status: WorkspaceProvisionProgressRow["status"],
  message?: string,
) {
  review.progress.push({ step, status, message, at: new Date().toISOString() });
}

async function callTool(
  params: {
    organizationId: string;
    traceId: string;
    actorUserId: string;
    agentId: string;
    runId: string;
    campaignId: string | null;
    tool_name: string;
    input: Record<string, unknown>;
    approval_mode?: "disabled" | "auto" | "enforced";
  },
) {
  const result = await executeOpenClawTool({
    organization_id: params.organizationId,
    trace_id: params.traceId,
    role_mode: "campaign_launcher",
    approval_mode: params.approval_mode ?? "auto",
    actor: { type: "user", user_id: params.actorUserId },
    campaign_id: params.campaignId,
    agent_id: params.agentId,
    run_id: params.runId,
    tool_name: params.tool_name,
    input: params.input,
  });
  if (!result.success) {
    throw new Error(`${params.tool_name}: ${result.error.code} — ${result.error.message}`);
  }
  return result.data as any;
}

async function agentIdForKey(
  admin: SupabaseClient,
  organizationId: string,
  key: string,
): Promise<string | null> {
  const agents = await listAgents(admin, organizationId);
  const row = (agents as any[]).find((a) => a.key === key);
  return row?.id ? String(row.id) : null;
}

export async function executeWorkspaceProvisioning(params: {
  admin: SupabaseClient;
  organizationId: string;
  actorUserId: string;
  launcherAgentId: string;
  runId: string;
  traceId: string;
  input: WorkspaceProvisionInput;
  devSeedRequested: boolean;
}): Promise<WorkspaceProvisionReview> {
  const { admin, organizationId, actorUserId, launcherAgentId, runId, traceId, input } = params;
  const review: WorkspaceProvisionReview = {
    kind: "workspace",
    traceId,
    mode: input.mode,
    organization: { id: organizationId },
    approvals: {
      campaign: false,
      funnel: false,
      content: false,
      email: false,
      tracking: false,
      review: false,
      organization: false,
      leads: false,
      workers: false,
      runs: false,
      approvals_panel: false,
      analytics: false,
      logs: false,
    },
    progress: [],
    warnings: [],
    errors: [],
    notes: input.notes ?? "",
  };

  const destinationUrl =
    input.mode === "affiliate"
      ? String(input.affiliate_link ?? "")
      : String(input.client_offer_url ?? "");
  const campaignGoal =
    input.mode === "affiliate"
      ? String(input.campaign_goal ?? "draft")
      : String(input.client_service_goal ?? "client delivery");

  const openclaw = describeOpenClawBackend();
  const resendConfigured = Boolean(env.server.RESEND_API_KEY && env.server.RESEND_FROM_EMAIL);
  review.integration_stub = {
    openclaw: { mode: openclaw.active, httpConfigured: openclaw.httpConfigured },
    email: resendConfigured ? "resend_configured" : "resend_not_configured_stub",
    outbound_publish: "not_live_provider_stub",
    note: "Internal records are real; external send/publish integrations remain gated or stubbed until configured.",
  };

  let envelopeCampaignId: string | null = null;
  const t = (name: string, body: Record<string, unknown>, approval?: "disabled") =>
    callTool({
      organizationId,
      traceId,
      actorUserId,
      agentId: launcherAgentId,
      runId,
      campaignId: envelopeCampaignId,
      tool_name: name,
      input: body,
      approval_mode: approval,
    });

  try {
    // --- Org defaults & policies (settings rows) ---
    await syncAgentsAndTemplates(admin, organizationId);
    pushProgress(review, "sync_agents_templates", "ok");

    const flags = getDefaultFeatureFlags();
    await mergeSettingJson(admin, organizationId, "feature_flags", flags as unknown as Record<string, unknown>);
    await mergeSettingJson(admin, organizationId, "approval_policy", {
      require_approval_before_publish: flags.require_approval_before_publish,
      require_approval_before_email: flags.require_approval_before_email,
      version: 1,
    });
    await mergeSettingJson(admin, organizationId, "lead_pipeline", {
      statuses: ["new", "contacted", "qualified", "won", "lost"],
      scoring_enabled: true,
      source_tracking: true,
      form_bindings: [],
      version: 1,
    });
    await mergeSettingJson(admin, organizationId, "workspace_bootstrap", {
      last_trace_id: traceId,
      last_run_id: runId,
      mode: input.mode,
      at: new Date().toISOString(),
    });
    review.lead_system = {
      settings_key: "lead_pipeline",
      summary: "Lead pipeline defaults stored in org settings (no leads created unless dev seed).",
    };
    review.settings_keys_initialized = ["feature_flags", "approval_policy", "lead_pipeline", "workspace_bootstrap"];
    pushProgress(review, "org_settings_init", "ok");
    await insertRunLog(admin, {
      organizationId,
      runId,
      level: "info",
      message: "Org settings + agent templates initialized",
      data: { keys: review.settings_keys_initialized },
    });

    // --- Campaign ---
    const campaignName =
      input.mode === "affiliate"
        ? `${input.niche} · ${input.traffic_source} · ${campaignGoal}`.slice(0, 80)
        : `${input.client_business_name ?? "Client"} · ${input.niche}`.slice(0, 80);
    const campaignType = input.mode === "affiliate" ? "affiliate" : "client";
    const rationale =
      input.mode === "affiliate"
        ? `Affiliate workspace.\nLink: ${input.affiliate_link}\nGoal: ${campaignGoal}\nAudience: ${input.target_audience}\nTraffic: ${input.traffic_source}`
        : `Client workspace.\nBusiness: ${input.client_business_name}\nOffer URL: ${input.client_offer_url}\nService goal: ${campaignGoal}\nAudience: ${input.target_audience}\nTraffic: ${input.traffic_source}`;

    const campaign = await t("create_campaign", {
      organizationId,
      name: campaignName,
      type: campaignType,
      status: "draft",
      target_audience: input.target_audience,
      description: [input.notes, rationale].filter(Boolean).join("\n\n"),
      metadata: {
        workspace_provision: {
          trace_id: traceId,
          mode: input.mode,
          affiliate_link: input.affiliate_link ?? null,
          client_offer_url: input.client_offer_url ?? null,
        },
      },
    });
    review.campaign = { id: campaign.id, name: campaign.name };
    envelopeCampaignId = campaign.id;
    pushProgress(review, "campaign", "ok");
    await admin
      .from("agent_runs" as never)
      .update({ campaign_id: campaign.id } as never)
      .eq("organization_id", organizationId)
      .eq("id", runId);

    // --- Funnel + steps ---
    const funnel = await t("create_funnel", {
      organizationId,
      name: `${input.niche} Funnel`.slice(0, 80),
      campaign_id: campaign.id,
      status: "draft",
      metadata: { trace_id: traceId },
    });
    review.funnel = { id: funnel.id, name: funnel.name };
    const base = slugify(input.niche) || "workspace";
    const stepDefs = [
      { name: "Landing page", step_type: "landing", slug: `${base}-landing` },
      { name: "Bridge page", step_type: "bridge", slug: `${base}-bridge` },
      {
        name: "Lead capture",
        step_type: "form",
        slug: `${base}-lead`,
        metadata: {
          lead_capture: {
            endpoint: "/api/leads/capture",
            organization_id: organizationId,
            campaign_id: campaign.id,
            funnel_id: funnel.id,
          },
        },
      },
      { name: "Primary CTA", step_type: "cta", slug: `${base}-cta` },
      { name: "Thank you", step_type: "thank_you", slug: `${base}-thanks` },
      { name: "Nurture trigger", step_type: "email_trigger", slug: `${base}-nurture` },
    ];
    const funnel_steps: WorkspaceProvisionReview["funnel_steps"] = [];
    for (const s of stepDefs) {
      const row = await t("add_funnel_step", {
        organizationId,
        funnel_id: funnel.id,
        name: s.name,
        step_type: s.step_type,
        slug: s.slug,
        metadata: (s as any).metadata ?? {},
      });
      funnel_steps.push({
        id: row.id,
        name: row.name,
        step_type: row.step_type,
        slug: row.slug,
      });
    }
    review.funnel_steps = funnel_steps;
    pushProgress(review, "funnel", "ok");

    // --- Content batch ---
    const content_assets: NonNullable<WorkspaceProvisionReview["content_assets"]> = [];
    const contentSpecs = [
      {
        title: `Landing copy · ${input.niche}`,
        kind: "landing_copy",
        hook: `Hooks for ${input.target_audience}`,
        body: `Draft landing structure.\n${rationale}`,
        platform: "web",
      },
      {
        title: `Bridge copy · ${input.niche}`,
        kind: "bridge_copy",
        hook: "Bridge angle",
        body: "Draft bridge: story → mechanism → CTA.",
        platform: "web",
      },
      {
        title: `Lead magnet · ${input.niche}`,
        kind: "lead_magnet",
        hook: "Lead magnet concept",
        body: "Outline: title, promise, outline, delivery.",
        platform: "web",
      },
      {
        title: `Short-form batch · ${input.niche}`,
        kind: "content_batch",
        hook: "Hooks / scripts / captions",
        body: "10 hooks · 3 short scripts · 3 CTAs (edit in Content).",
        platform: input.traffic_source,
      },
      {
        title: `CTA variants · ${input.traffic_source}`,
        kind: "cta_variants",
        hook: "CTA A/B concepts",
        body: "Primary / secondary / soft CTA variants for testing.",
        platform: input.traffic_source,
      },
    ];
    for (const c of contentSpecs) {
      const a = await t("create_content_asset", {
        organizationId,
        title: c.title.slice(0, 120),
        platform: c.platform,
        status: "draft",
        campaign_id: campaign.id,
        funnel_id: funnel.id,
        hook: c.hook,
        body: c.body,
        metadata: { trace_id: traceId, kind: c.kind },
      });
      content_assets.push({ id: a.id, title: a.title, status: a.status });
    }
    review.content_assets = content_assets;
    pushProgress(review, "content", "ok");

    // --- Email ---
    const t1 = await t("create_email_template", {
      organizationId,
      name: `Welcome · ${input.niche}`.slice(0, 120),
      subject: `Quick win for ${input.target_audience}`.slice(0, 120),
      body_markdown: `**${input.niche}** — review before send.\n\n${rationale.slice(0, 800)}`,
      status: "draft",
    });
    const t2 = await t("create_email_template", {
      organizationId,
      name: `Value · ${input.niche}`.slice(0, 120),
      subject: "Why this matters now",
      body_markdown: "Educational body (draft).",
      status: "draft",
    });
    const t3 = await t("create_email_template", {
      organizationId,
      name: `CTA · ${input.niche}`.slice(0, 120),
      subject: "Recommended next step",
      body_markdown: `Next step + link context:\n${destinationUrl}`,
      status: "draft",
    });
    const sequence = await t("create_email_sequence", {
      organizationId,
      name: `${input.niche} nurture`.slice(0, 120),
      description: `Goal: ${campaignGoal} · Traffic: ${input.traffic_source}`,
      is_active: false,
    });
    await t("add_email_sequence_step", {
      organizationId,
      sequence_id: sequence.id,
      template_id: t1.id,
      delay_minutes: 0,
    });
    await t("add_email_sequence_step", {
      organizationId,
      sequence_id: sequence.id,
      template_id: t2.id,
      delay_minutes: 60 * 24,
    });
    await t("add_email_sequence_step", {
      organizationId,
      sequence_id: sequence.id,
      template_id: t3.id,
      delay_minutes: 60 * 48,
    });
    review.email = {
      sequence: { id: sequence.id, name: sequence.name },
      templates: [
        { id: t1.id, name: t1.name, subject: t1.subject, status: t1.status },
        { id: t2.id, name: t2.name, subject: t2.subject, status: t2.status },
        { id: t3.id, name: t3.name, subject: t3.subject, status: t3.status },
      ],
    };
    pushProgress(review, "email", "ok");

    // --- Tracking ---
    const link = await t("create_tracking_link", {
      organizationId,
      destination_url: destinationUrl,
      label: `${input.niche} · ${input.traffic_source}`.slice(0, 120),
      campaign_id: campaign.id,
      utm_defaults: {
        utm_source: input.traffic_source,
        utm_campaign: slugify(input.niche),
      },
    });
    review.tracking = { link: { id: link.id, destination_url: link.destination_url } };
    pushProgress(review, "tracking", "ok");

    // Attach CTA click wiring to the CTA funnel step (best-effort).
    const ctaStepId = (review.funnel_steps ?? []).find((s) => s.step_type === "cta")?.id;
    if (ctaStepId) {
      await t("update_funnel_step", {
        organizationId,
        step_id: ctaStepId,
        metadata: {
          cta: {
            click_url: `/api/affiliate/click/${link.id}`,
            affiliate_link_id: link.id,
            destination_url: link.destination_url,
          },
        },
      });
    }

    // --- Campaign workers ---
    const workerKeys = ["campaign_launcher", "analyst_worker", "content_strategist", "lead_nurture_worker"] as const;
    const assigned: NonNullable<WorkspaceProvisionReview["workers"]>["assigned"] = [];
    for (const key of workerKeys) {
      const aid = await agentIdForKey(admin, organizationId, key);
      if (!aid) {
        review.warnings.push(`Missing agent definition for ${key} after sync.`);
        continue;
      }
      await assignCampaignAgent(admin, {
        organization_id: organizationId,
        campaign_id: campaign.id,
        agent_id: aid,
        priority: key === "campaign_launcher" ? 0 : 10,
        config: { workspace_trace: traceId, mode: input.mode },
      });
      assigned.push({ agent_key: key, id: aid });
    }
    review.workers = { assigned };
    pushProgress(review, "workers", "ok");

    // --- Approvals (queue items; high-risk execution still gated elsewhere) ---
    const approval_items: NonNullable<WorkspaceProvisionReview["approval_items"]> = [];
    const firstContentId = content_assets[0]?.id;
    if (firstContentId) {
      const a1 = await t(
        "create_approval_item",
        {
          organizationId,
          approval_type: "content_publishing",
          campaign_id: campaign.id,
          requested_by_user_id: actorUserId,
          payload: { reason: "Review AI-generated copy before publish", content_asset_id: firstContentId },
        },
        "disabled",
      );
      approval_items.push({ id: a1.id, approval_type: a1.approval_type });
    }
    const a2 = await t(
      "create_approval_item",
      {
        organizationId,
        approval_type: "email_sending",
        campaign_id: campaign.id,
        requested_by_user_id: actorUserId,
        payload: { reason: "Review sequence before activation", sequence_id: sequence.id },
      },
      "disabled",
    );
    approval_items.push({ id: a2.id, approval_type: a2.approval_type });
    const a3 = await t(
      "create_approval_item",
      {
        organizationId,
        approval_type: "affiliate_cta_activation",
        campaign_id: campaign.id,
        requested_by_user_id: actorUserId,
        payload: { reason: "Review tracking link / CTA before activation", link_id: link.id },
      },
      "disabled",
    );
    approval_items.push({ id: a3.id, approval_type: a3.approval_type });
    review.approval_items = approval_items;
    pushProgress(review, "approvals", "ok");

    // --- Analytics baseline ---
    await t("log_analytics_event", {
      organizationId,
      event_name: "workspace.provisioned",
      source: "workspace_orchestrator",
      campaign_id: campaign.id,
      funnel_id: funnel.id,
      metadata: { trace_id: traceId, mode: input.mode },
    });
    review.analytics = { baseline_logged: true, event: "workspace.provisioned" };
    pushProgress(review, "analytics", "ok");

    // --- Child runs (pending records for follow-up workers) ---
    const child_runs: NonNullable<WorkspaceProvisionReview["child_runs"]> = [];
    const analystId = await agentIdForKey(admin, organizationId, "analyst_worker");
    const strategistId = await agentIdForKey(admin, organizationId, "content_strategist");
    if (analystId) {
      const cr = await t("create_agent_run", {
        organizationId,
        agent_id: analystId,
        campaign_id: campaign.id,
        actor_user_id: actorUserId,
        input: {
          parent_run_id: runId,
          trace_id: traceId,
          purpose: "post_provision_analyst_pass",
          stub: true,
        },
      });
      child_runs.push({ id: cr.id, agent_key: "analyst_worker" });
    }
    if (strategistId) {
      const cr = await t("create_agent_run", {
        organizationId,
        agent_id: strategistId,
        campaign_id: campaign.id,
        actor_user_id: actorUserId,
        input: {
          parent_run_id: runId,
          trace_id: traceId,
          purpose: "post_provision_content_batch",
          stub: true,
        },
      });
      child_runs.push({ id: cr.id, agent_key: "content_strategist" });
    }
    review.child_runs = child_runs;
    pushProgress(review, "child_runs", "ok");

    // --- Dev-only seed ---
    const devAllowed =
      params.devSeedRequested &&
      env.server.NODE_ENV === "development" &&
      env.server.WORKSPACE_DEV_SEED === "1";
    if (params.devSeedRequested && !devAllowed) {
      review.warnings.push("Dev seed requested but skipped (requires NODE_ENV=development and WORKSPACE_DEV_SEED=1).");
    }
    if (devAllowed) {
      await t("create_lead", {
        organizationId,
        email: "demo-lead@example.com",
        name: "Demo lead (dev seed)",
        status: "new",
        score: 10,
        campaign_id: campaign.id,
        funnel_id: funnel.id,
        metadata: { workspace_dev_seed: true, trace_id: traceId },
      });
      await t("log_analytics_event", {
        organizationId,
        event_name: "dev.sample_event",
        source: "workspace_dev_seed",
        campaign_id: campaign.id,
        metadata: { trace_id: traceId },
      });
      review.dev_seeded = true;
      pushProgress(review, "dev_seed", "ok");
    }

    await writeAuditLog({
      organizationId,
      actorUserId,
      action: "workspace.provisioned",
      entityType: "agent_run",
      entityId: runId,
      metadata: {
        trace_id: traceId,
        mode: input.mode,
        campaign_id: campaign.id,
        funnel_id: funnel.id,
      },
    });

    await insertRunLog(admin, {
      organizationId,
      runId,
      level: "info",
      message: "Workspace provisioning completed",
      data: { campaignId: campaign.id, funnelId: funnel.id },
    });

    return review;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    review.errors.push(msg);
    pushProgress(review, "orchestrator", "error", msg);
    await insertRunLog(admin, {
      organizationId,
      runId,
      level: "error",
      message: "Workspace provisioning failed",
      data: { error: msg },
    });
    await writeAuditLog({
      organizationId,
      actorUserId,
      action: "workspace.provision_failed",
      entityType: "agent_run",
      entityId: runId,
      metadata: { trace_id: traceId, error: msg, partial: review },
    });
    return review;
  }
}
