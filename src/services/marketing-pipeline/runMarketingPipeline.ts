import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";
import { env } from "@/lib/env";
import { writeAuditLog } from "@/services/audit/auditService";
import { runWorkerAndPersist } from "@/services/marketing-pipeline/workerRunner";

import {
  marketingPipelineStageKeySchema,
  runMarketingPipelineInputSchema,
  type MarketingPipelineStageKey,
  type MarketingPipelineStageStatus,
  type RunMarketingPipelineInput,
  type RunMarketingPipelineOutput,
} from "./types";

type StageRow = { id: string; stage_key: MarketingPipelineStageKey; status: MarketingPipelineStageStatus };

function nowIso() {
  return new Date().toISOString();
}

function stageWorkers(stage: MarketingPipelineStageKey): string[] {
  switch (stage) {
    case "research":
      return ["ads_analyst", "offer_analyst", "competitor_researcher", "landing_page_analyst"];
    case "strategy":
      return ["head_of_marketing", "brand_strategist", "campaign_planner", "funnel_strategist"];
    case "creation":
      return ["creative_director", "copywriter", "scriptwriter", "page_designer", "email_writer", "ad_designer"];
    case "execution":
      return ["performance_marketer", "funnel_publisher", "email_automation_worker", "lead_capture_worker", "tracking_worker"];
    case "optimization":
      return ["analytics_analyst", "cro_worker", "report_worker", "recommendation_worker"];
  }
}

async function toolOk<T>(body: unknown): Promise<T> {
  const res = await executeOpenClawTool(body);
  if (!res.success) throw new Error(`${res.error.code}: ${res.error.message}`);
  return res.data as T;
}

async function insertStageLog(params: {
  organizationId: string;
  pipelineRunId: string;
  stageId?: string | null;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("marketing_pipeline_stage_logs" as never)
    .insert({
      organization_id: params.organizationId,
      pipeline_run_id: params.pipelineRunId,
      stage_id: params.stageId ?? null,
      level: params.level,
      message: params.message,
      data: params.data ?? {},
    } as never)
    .select("id,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { id: String((data as any).id), at: String((data as any).created_at) };
}

async function insertStageOutput(params: {
  organizationId: string;
  pipelineRunId: string;
  stageId: string;
  outputType?: string;
  content: Record<string, unknown>;
  createdRecordRefs: Array<{ table: string; id: string; label?: string }>;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("marketing_pipeline_stage_outputs" as never)
    .insert({
      organization_id: params.organizationId,
      pipeline_run_id: params.pipelineRunId,
      stage_id: params.stageId,
      output_type: params.outputType ?? "stage.output",
      content: params.content,
      created_record_refs: params.createdRecordRefs,
    } as never)
    .select("id,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { id: String((data as any).id), at: String((data as any).created_at) };
}

async function upsertSkillOutput(params: {
  organizationId: string;
  pipelineRunId: string;
  stageId: string;
  skillKey: string;
  status: "completed" | "failed";
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  provider: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  await admin.from("ai_worker_skill_outputs" as never).insert({
    organization_id: params.organizationId,
    pipeline_run_id: params.pipelineRunId,
    stage_id: params.stageId,
    skill_key: params.skillKey,
    status: params.status,
    input: params.input,
    output: params.output,
    provider: params.provider,
    metadata: params.metadata ?? {},
  } as never);
}

async function setStageStatus(params: {
  organizationId: string;
  pipelineRunId: string;
  stageId: string;
  stageKey: MarketingPipelineStageKey;
  status: MarketingPipelineStageStatus;
  outputSummary?: string | null;
  errorMessage?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  await admin
    .from("marketing_pipeline_stages" as never)
    .update({
      status: params.status,
      started_at: params.status === "running" ? nowIso() : undefined,
      finished_at: params.status === "completed" || params.status === "failed" || params.status === "needs_approval" ? nowIso() : undefined,
      output_summary: params.outputSummary ?? undefined,
      error_message: params.errorMessage ?? undefined,
      updated_at: nowIso(),
    } as never)
    .eq("organization_id", params.organizationId)
    .eq("pipeline_run_id", params.pipelineRunId)
    .eq("stage_key", params.stageKey);
}

async function setRunStatus(params: {
  organizationId: string;
  pipelineRunId: string;
  status: "pending" | "running" | "completed" | "failed" | "needs_approval";
  currentStage?: MarketingPipelineStageKey | null;
  warnings?: string[];
  errors?: string[];
}) {
  const admin = createSupabaseAdminClient();
  await admin
    .from("marketing_pipeline_runs" as never)
    .update({
      status: params.status,
      current_stage: params.currentStage ?? undefined,
      started_at: params.status === "running" ? nowIso() : undefined,
      finished_at: params.status === "completed" || params.status === "failed" ? nowIso() : undefined,
      warnings: params.warnings ?? undefined,
      errors: params.errors ?? undefined,
      updated_at: nowIso(),
    } as never)
    .eq("organization_id", params.organizationId)
    .eq("id", params.pipelineRunId);
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) return candidate;
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return null;
}

function stubResearch(input: RunMarketingPipelineInput) {
  const modeHint = input.mode === "affiliate" ? "affiliate offer" : "client offer";
  return {
    offer_summary: `Draft offer summary for ${modeHint} at ${input.url}.`,
    icp: {
      audience: input.audience,
      goal: input.goal,
      traffic_source: input.trafficSource,
    },
    pain_points: [
      `Time/complexity getting results with ${input.goal}`,
      "Unclear steps / lack of system",
      "Inconsistent lead flow",
    ],
    competitor_angles: [
      "Speed & simplicity angle",
      "System/OS angle",
      "Proof via mini-case-studies angle",
    ],
    hook_opportunities: [
      "3 mistakes X makes",
      "Do this before you run ads",
      "Stop scrolling if you want X",
    ],
    landing_page_notes: [
      "Above-the-fold: clear promise + primary CTA",
      "Bridge: story + mechanism + social proof placeholders",
      "FAQ: handle objections for traffic source",
    ],
    provider_mode: "stub",
  };
}

function stubStrategy(input: RunMarketingPipelineInput, research: Record<string, unknown>) {
  return {
    campaign_strategy: {
      north_star: input.goal,
      positioning: "Stage-based AI marketing OS with human approvals for high-risk actions.",
      primary_offer: (research as any)?.offer_summary ?? "Draft offer",
    },
    funnel_plan: {
      steps: ["landing", "bridge", "form", "cta", "thank_you", "email_trigger"],
      primary_cta: input.mode === "affiliate" ? "affiliate click" : "book call / lead",
    },
    brand_angle: "Pragmatic, systems-first, outcomes-driven.",
    cta_strategy: {
      primary: "Get the plan / start free / download",
      secondary: "Watch 30s explainer",
    },
    traffic_plan: {
      source: input.trafficSource,
      content_types: ["hooks", "short scripts", "proof snippets", "how-to"],
    },
    provider_mode: "stub",
  };
}

async function maybeInternalLlmJson(params: {
  provider: RunMarketingPipelineInput["provider"];
  prompt: string;
  schemaHint: string;
  fallback: Record<string, unknown>;
}) {
  const provider = env.server.INTERNAL_LLM_PROVIDER;
  const apiKey = env.server.INTERNAL_LLM_API_KEY;
  const model = env.server.INTERNAL_LLM_MODEL;
  const baseUrl = (env.server.INTERNAL_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  const wantsLlm = params.provider === "internal_llm" || params.provider === "hybrid";
  if (!wantsLlm || provider !== "openai" || !apiKey || !model) {
    return {
      json: params.fallback,
      meta: {
        used: false,
        provider: "fallback",
        model: model ?? undefined,
        baseUrl,
        reason: !wantsLlm
          ? "Provider does not request internal_llm"
          : provider !== "openai"
            ? "INTERNAL_LLM_PROVIDER is not 'openai'"
            : !apiKey
              ? "Missing INTERNAL_LLM_API_KEY"
              : "Missing INTERNAL_LLM_MODEL",
      },
    };
  }

  const systemPrompt = "Return ONLY valid JSON. No markdown.";
  const userPrompt = JSON.stringify(
    {
      task: "Generate marketing pipeline stage output JSON.",
      schema_hint: params.schemaHint,
      prompt: params.prompt,
    },
    null,
    2,
  );

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (e) {
    return {
      json: params.fallback,
      meta: {
        used: false,
        provider: "fallback",
        model,
        baseUrl,
        reason: `Fetch failed: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }

  if (!response.ok) {
    return {
      json: params.fallback,
      meta: {
        used: false,
        provider: "fallback",
        model,
        baseUrl,
        httpStatus: response.status,
        reason: `OpenAI HTTP ${response.status}`,
      },
    };
  }

  const payload = (await response.json().catch(() => null)) as any;
  const text = String(payload?.choices?.[0]?.message?.content ?? "");
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return { json: params.fallback, meta: { used: false, provider: "fallback", model, baseUrl, reason: "No JSON in response" } };
  }
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return { json: parsed, meta: { used: true, provider: "openai", model, baseUrl } };
  } catch (e) {
    return {
      json: params.fallback,
      meta: { used: false, provider: "fallback", model, baseUrl, reason: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` },
    };
  }
}

export async function runMarketingPipeline(params: {
  supabase: SupabaseClient;
  actorUserId: string;
  input: RunMarketingPipelineInput;
}): Promise<RunMarketingPipelineOutput> {
  const parsed = runMarketingPipelineInputSchema.safeParse(params.input);
  if (!parsed.success) throw new Error(parsed.error.message);

  const admin = createSupabaseAdminClient();
  const input = parsed.data;

  // --- Resolve organization ---
  let organizationId = input.organizationId ?? "";
  if (input.organizationMode === "create") {
    const name = input.organizationName ?? "New Organization";
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || `org-${crypto.randomUUID().slice(0, 8)}`;
    const { data: org, error } = await params.supabase.rpc("create_organization_with_owner" as never, {
      org_name: name,
      org_slug: slug,
    } as never);
    if (error || !org) throw new Error(error?.message ?? "Failed to create organization");
    organizationId = String((org as any).id);
  }
  if (!organizationId) throw new Error("organizationId required");

  // --- Create pipeline run + stage rows ---
  const { data: runRow, error: runErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .insert({
      organization_id: organizationId,
      provider: input.provider,
      approval_mode: input.approvalMode,
      input,
      status: "running",
      current_stage: "research",
      started_at: nowIso(),
    } as never)
    .select("id")
    .single();
  if (runErr || !runRow) throw new Error(runErr?.message ?? "Failed to create pipeline run");
  const pipelineRunId = String((runRow as any).id);

  const stageKeys: MarketingPipelineStageKey[] = marketingPipelineStageKeySchema.options;
  const stages: Record<MarketingPipelineStageKey, StageRow> = {} as any;

  for (const stageKey of stageKeys) {
    const { data: sRow, error: sErr } = await admin
      .from("marketing_pipeline_stages" as never)
      .insert({
        organization_id: organizationId,
        pipeline_run_id: pipelineRunId,
        stage_key: stageKey,
        status: stageKey === "research" ? "running" : "pending",
        assigned_workers: stageWorkers(stageKey),
        started_at: stageKey === "research" ? nowIso() : null,
      } as never)
      .select("id,stage_key,status")
      .single();
    if (sErr || !sRow) throw new Error(sErr?.message ?? `Failed to create stage ${stageKey}`);
    stages[stageKey] = { id: String((sRow as any).id), stage_key: stageKey, status: String((sRow as any).status) as any };
  }

  const createdRecords: Array<{ table: string; id: string; label?: string }> = [];
  const approvalItems: Array<{ id: string; approval_type?: string }> = [];
  const logs: Array<{ id: string; stage_key?: MarketingPipelineStageKey | null; level: string; message: string; at: string }> = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let campaignId: string | null = null;
  let funnelId: string | null = null;
  let funnelStepIds: Record<string, string> = {};
  const traceId = `trace_${crypto.randomUUID()}`;

  const envelopeBase = {
    organization_id: organizationId,
    trace_id: traceId,
    role_mode: "campaign_launcher",
    approval_mode: input.approvalMode === "required" ? "auto" : "auto",
    actor: { type: "user", user_id: params.actorUserId },
  } as const;

  const log = async (stageKey: MarketingPipelineStageKey, level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) => {
    const row = await insertStageLog({ organizationId, pipelineRunId, stageId: stages[stageKey].id, level, message, data });
    logs.push({ id: row.id, stage_key: stageKey, level, message, at: row.at });
  };

  try {
    await writeAuditLog({
      organizationId,
      actorUserId: params.actorUserId,
      action: "marketing_pipeline.started",
      entityType: "marketing_pipeline_runs",
      entityId: pipelineRunId,
      metadata: { trace_id: traceId, input },
    });

    // ---------------- Stage 1: RESEARCH ----------------
    await log("research", "info", "Research stage started", { url: input.url, goal: input.goal, audience: input.audience });
    const researchFallback = stubResearch(input);
    const offer = await runWorkerAndPersist({
      organizationId,
      campaignId: null,
      pipelineRunId,
      stageKey: "research",
      workerKey: "offer_analyst",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { url: input.url, goal: input.goal, audience: input.audience, trafficSource: input.trafficSource, notes: input.notes ?? null },
      schemaHint: "Return JSON with keys: offer_summary, pain_points[], objections[], mechanism, cta_recommendations{primary,secondary}.",
      prompt: `Analyze URL=${input.url}. Mode=${input.mode}. Audience=${input.audience}. Goal=${input.goal}. Traffic=${input.trafficSource}.`,
      fallback: researchFallback,
    });
    const ads = await runWorkerAndPersist({
      organizationId,
      campaignId: null,
      pipelineRunId,
      stageKey: "research",
      workerKey: "ads_analyst",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { url: input.url, goal: input.goal, audience: input.audience, trafficSource: input.trafficSource },
      schemaHint: "Return JSON with keys: platform_constraints{}, angle_themes[], hook_starters[], targeting_hypotheses[].",
      prompt: `Analyze platform=${input.trafficSource} for audience=${input.audience} goal=${input.goal}.`,
      fallback: { provider_mode: "stub" },
    });
    const comp = await runWorkerAndPersist({
      organizationId,
      campaignId: null,
      pipelineRunId,
      stageKey: "research",
      workerKey: "competitor_researcher",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { url: input.url, audience: input.audience, goal: input.goal },
      schemaHint: "Return JSON with keys: competitor_angle_themes[], common_promises[], differentiation_opportunities[], risk_notes[].",
      prompt: `Summarize competitor messaging patterns relevant to ${input.url} and audience=${input.audience}.`,
      fallback: { provider_mode: "stub" },
    });
    const lp = await runWorkerAndPersist({
      organizationId,
      campaignId: null,
      pipelineRunId,
      stageKey: "research",
      workerKey: "landing_page_analyst",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { offer: offer.output, ads: ads.output, competitors: comp.output },
      schemaHint: "Return JSON with keys: headline_options[], section_outline[], cta_plan[], notes[].",
      prompt: `Create landing page analysis for traffic=${input.trafficSource} goal=${input.goal}.`,
      fallback: { provider_mode: "stub" },
    });

    const research = {
      offer: offer.output,
      ads: ads.output,
      competitors: comp.output,
      landing: lp.output,
      icp: { audience: input.audience, goal: input.goal, traffic_source: input.trafficSource },
      provider_mode: offer.meta?.provider ?? "stub",
    } as Record<string, unknown>;

    await upsertSkillOutput({
      organizationId,
      pipelineRunId,
      stageId: stages.research.id,
      skillKey: "research_bundle",
      status: offer.ok ? "completed" : "failed",
      input: { url: input.url, goal: input.goal, audience: input.audience },
      output: research,
      provider: String(input.provider),
      metadata: { worker_run_ids: { offer: offer.runId, ads: ads.runId, competitor: comp.runId, landing: lp.runId } },
    });
    await insertStageOutput({
      organizationId,
      pipelineRunId,
      stageId: stages.research.id,
      outputType: "research.output",
      content: research,
      createdRecordRefs: [],
    });
    await setStageStatus({
      organizationId,
      pipelineRunId,
      stageId: stages.research.id,
      stageKey: "research",
      status: "completed",
      outputSummary: "Research output saved",
    });
    stages.research.status = "completed";

    // ---------------- Stage 2: STRATEGY ----------------
    await setRunStatus({ organizationId, pipelineRunId, status: "running", currentStage: "strategy" });
    await setStageStatus({ organizationId, pipelineRunId, stageId: stages.strategy.id, stageKey: "strategy", status: "running" });
    stages.strategy.status = "running";
    await log("strategy", "info", "Strategy stage started", { provider: input.provider });
    const head = await runWorkerAndPersist({
      organizationId,
      campaignId: null,
      pipelineRunId,
      stageKey: "strategy",
      workerKey: "head_of_marketing",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { research, goal: input.goal, audience: input.audience, trafficSource: input.trafficSource },
      schemaHint: "Return JSON with keys: campaign_strategy{}, funnel_plan{steps[]}, traffic_plan{}, risk_checklist[].",
      prompt: `Create strategy from research for goal=${input.goal} traffic=${input.trafficSource}.`,
      fallback: stubStrategy(input, research),
    });
    const brand = await runWorkerAndPersist({
      organizationId,
      campaignId: null,
      pipelineRunId,
      stageKey: "strategy",
      workerKey: "brand_strategist",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { research, strategy: head.output },
      schemaHint: "Return JSON with keys: tone, messaging_pillars[], words_to_use[], words_to_avoid[], credibility_needs[].",
      prompt: "Generate brand voice + messaging pillars.",
      fallback: { provider_mode: "stub" },
    });
    const planner = await runWorkerAndPersist({
      organizationId,
      campaignId: null,
      pipelineRunId,
      stageKey: "strategy",
      workerKey: "campaign_planner",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { research, strategy: head.output, brand: brand.output },
      schemaHint: "Return JSON with keys: build_checklist[], asset_counts{}, approvals_to_request[].",
      prompt: "Convert strategy into concrete build checklist and asset counts.",
      fallback: { provider_mode: "stub" },
    });
    const strategy = { head: head.output, brand: brand.output, plan: planner.output } as Record<string, unknown>;
    await upsertSkillOutput({
      organizationId,
      pipelineRunId,
      stageId: stages.strategy.id,
      skillKey: "strategy_bundle",
      status: head.ok ? "completed" : "failed",
      input: { research },
      output: strategy,
      provider: String(input.provider),
      metadata: { worker_run_ids: { head: head.runId, brand: brand.runId, planner: planner.runId } },
    });

    // Create campaign + funnel (safe tool layer)
    const campaign = await toolOk<any>({
      ...envelopeBase,
      campaign_id: null,
      agent_id: null,
      run_id: null,
      tool_name: "create_campaign",
      input: {
        organizationId,
        name: `${input.mode === "affiliate" ? "Affiliate" : "Client"} · ${input.trafficSource} · ${input.goal}`.slice(0, 80),
        type: input.mode === "affiliate" ? "affiliate" : "client",
        status: "draft",
        target_audience: input.audience,
        description: [input.notes, `URL: ${input.url}`].filter(Boolean).join("\n"),
        metadata: { marketing_pipeline: { run_id: pipelineRunId, trace_id: traceId, strategy_bundle: strategy } },
      },
    });
    campaignId = String(campaign.id);
    createdRecords.push({ table: "campaigns", id: campaignId, label: campaign.name });

    const funnel = await toolOk<any>({
      ...envelopeBase,
      campaign_id: campaignId,
      agent_id: null,
      run_id: null,
      tool_name: "create_funnel",
      input: {
        organizationId,
        name: `Funnel · ${input.goal}`.slice(0, 80),
        campaign_id: campaignId,
        status: "draft",
        metadata: { marketing_pipeline: { run_id: pipelineRunId, trace_id: traceId } },
      },
    });
    funnelId = String(funnel.id);
    createdRecords.push({ table: "funnels", id: funnelId, label: funnel.name });

    const stepDefs = [
      { name: "Landing page", step_type: "landing", slug: "landing" },
      { name: "Bridge page", step_type: "bridge", slug: "bridge" },
      { name: "Lead capture", step_type: "form", slug: "lead" },
      { name: "Primary CTA", step_type: "cta", slug: "cta" },
      { name: "Thank you", step_type: "thank_you", slug: "thanks" },
      { name: "Nurture trigger", step_type: "email_trigger", slug: "nurture" },
    ];
    let stepIndex = 0;
    for (const s of stepDefs) {
      const row = await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        tool_name: "add_funnel_step",
        input: {
          organizationId,
          funnel_id: funnelId,
          name: s.name,
          step_type: s.step_type,
          slug: `mp-${pipelineRunId.slice(0, 6)}-${s.slug}`,
          metadata: { marketing_pipeline: { stage: "strategy", trace_id: traceId, step_index: stepIndex } },
        },
      });
      funnelStepIds[s.step_type] = String(row.id);
      createdRecords.push({ table: "funnel_steps", id: String(row.id), label: `${s.step_type}:${row.slug}` });
      stepIndex += 1;
    }

    await insertStageOutput({
      organizationId,
      pipelineRunId,
      stageId: stages.strategy.id,
      outputType: "strategy.output",
      content: { ...strategy, campaignId, funnelId, funnelStepIds },
      createdRecordRefs: createdRecords,
    });
    await setStageStatus({
      organizationId,
      pipelineRunId,
      stageId: stages.strategy.id,
      stageKey: "strategy",
      status: "completed",
      outputSummary: "Campaign + funnel created",
    });
    stages.strategy.status = "completed";

    // ---------------- Stage 3: CREATION ----------------
    await setRunStatus({ organizationId, pipelineRunId, status: "running", currentStage: "creation" });
    await setStageStatus({ organizationId, pipelineRunId, stageId: stages.creation.id, stageKey: "creation", status: "running" });
    stages.creation.status = "running";
    await log("creation", "info", "Creation stage started");

    if (!campaignId || !funnelId) throw new Error("Missing campaign/funnel in creation stage");

    // Content assets (landing + bridge copy, hooks, scripts)
    const landingCopy = `# ${input.goal}\n\nDraft landing copy for ${input.audience}.\n\n- Promise\n- Proof placeholders\n- CTA`;
    const bridgeCopy = `# Bridge\n\nStory → mechanism → CTA for ${input.url}.`;
    const hooks = Array.from({ length: 20 }).map((_, i) => `Hook ${i + 1}: ${input.audience} — ${input.goal}`);
    const scripts = Array.from({ length: 10 }).map((_, i) => `## Script ${i + 1}\n\nHook: ${hooks[i]}\n\nBody: ...\n\nCTA: ...`);

    const createdContentAssetIds: string[] = [];
    for (const spec of [
      { title: `Landing copy · ${input.goal}`, kind: "landing_copy", platform: "web", hook: hooks[0], body: landingCopy },
      { title: `Bridge copy · ${input.goal}`, kind: "bridge_copy", platform: "web", hook: hooks[1], body: bridgeCopy },
      { title: `Hooks · ${input.trafficSource}`, kind: "hooks", platform: input.trafficSource, hook: "Hook bank", body: hooks.join("\n") },
      { title: `Short video scripts · ${input.trafficSource}`, kind: "short_video_scripts", platform: input.trafficSource, hook: "Scripts", body: scripts.join("\n\n") },
    ]) {
      const a = await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        tool_name: "create_content_asset",
        input: {
          organizationId,
          title: spec.title.slice(0, 120),
          platform: spec.platform,
          status: "draft",
          campaign_id: campaignId,
          funnel_id: funnelId,
          hook: spec.hook,
          body: spec.body,
          metadata: { trace_id: traceId, kind: spec.kind, pipeline_run_id: pipelineRunId },
        },
      });
      createdContentAssetIds.push(String(a.id));
      createdRecords.push({ table: "content_assets", id: String(a.id), label: a.title });
    }

    // Landing + bridge pages (DB records) and funnel step render data
    const landingStepId = funnelStepIds["landing"];
    const bridgeStepId = funnelStepIds["bridge"];
    if (landingStepId) {
      const { data: lp, error: lpErr } = await admin
        .from("landing_pages" as never)
        .upsert(
          {
            organization_id: organizationId,
            funnel_step_id: landingStepId,
            title: `Landing · ${input.goal}`.slice(0, 120),
            description: `Landing page for ${input.audience}`.slice(0, 200),
            blocks: [{ type: "markdown", markdown: landingCopy }],
            seo: { title: `Landing · ${input.goal}` },
            updated_at: nowIso(),
          } as never,
          { onConflict: "funnel_step_id" },
        )
        .select("id")
        .single();
      if (!lpErr && lp) createdRecords.push({ table: "landing_pages", id: String((lp as any).id), label: "landing_page" });
      await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        tool_name: "update_funnel_step",
        input: {
          organizationId,
          step_id: landingStepId,
          metadata: { page: { kind: "markdown", title: `Landing · ${input.goal}`, markdown: landingCopy } },
        },
      });
    }
    if (bridgeStepId) {
      const { data: bp, error: bpErr } = await admin
        .from("bridge_pages" as never)
        .upsert(
          {
            organization_id: organizationId,
            funnel_step_id: bridgeStepId,
            title: `Bridge · ${input.goal}`.slice(0, 120),
            description: `Bridge page for ${input.audience}`.slice(0, 200),
            blocks: [{ type: "markdown", markdown: bridgeCopy }],
            seo: { title: `Bridge · ${input.goal}` },
            updated_at: nowIso(),
          } as never,
          { onConflict: "funnel_step_id" },
        )
        .select("id")
        .single();
      if (!bpErr && bp) createdRecords.push({ table: "bridge_pages", id: String((bp as any).id), label: "bridge_page" });
      await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        tool_name: "update_funnel_step",
        input: {
          organizationId,
          step_id: bridgeStepId,
          metadata: { page: { kind: "markdown", title: `Bridge · ${input.goal}`, markdown: bridgeCopy } },
        },
      });
    }

    // Ad creatives (DB records)
    const adRows = Array.from({ length: 10 }).map((_, i) => ({
      organization_id: organizationId,
      campaign_id: campaignId,
      platform: input.trafficSource,
      format: "short_video",
      status: "draft",
      headline: `Ad ${i + 1}: ${input.goal}`.slice(0, 120),
      primary_text: hooks[i % hooks.length].slice(0, 300),
      script_markdown: scripts[i % scripts.length],
      metadata: { pipeline_run_id: pipelineRunId, trace_id: traceId, index: i },
      updated_at: nowIso(),
    }));
    const { data: adCreatives, error: adErr } = await admin.from("ad_creatives" as never).insert(adRows as never).select("id");
    if (!adErr) {
      for (const r of (adCreatives ?? []) as any[]) createdRecords.push({ table: "ad_creatives", id: String(r.id), label: "ad_creative" });
    } else {
      warnings.push(`ad_creatives insert failed (kept going): ${adErr.message}`);
      await log("creation", "warn", "Failed to insert ad_creatives (non-fatal)", { error: adErr.message });
    }

    // Email templates (5)
    const emailTemplateIds: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const tpl = await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        tool_name: "create_email_template",
        input: {
          organizationId,
          name: `Pipeline email ${i + 1} · ${input.goal}`.slice(0, 120),
          subject: `Step ${i + 1}: ${input.goal}`.slice(0, 120),
          body_markdown: `Draft email ${i + 1} for ${input.audience}.\n\nGoal: ${input.goal}\nURL: ${input.url}`,
          status: "draft",
        },
      });
      emailTemplateIds.push(String(tpl.id));
      createdRecords.push({ table: "email_templates", id: String(tpl.id), label: tpl.name });
    }

    await insertStageOutput({
      organizationId,
      pipelineRunId,
      stageId: stages.creation.id,
      outputType: "creation.output",
      content: {
        landing_copy: landingCopy,
        bridge_copy: bridgeCopy,
        hooks,
        scripts,
        counts: {
          content_assets: createdContentAssetIds.length,
          ad_creatives: 10,
          email_templates: emailTemplateIds.length,
        },
      },
      createdRecordRefs: createdRecords,
    });
    await setStageStatus({
      organizationId,
      pipelineRunId,
      stageId: stages.creation.id,
      stageKey: "creation",
      status: "completed",
      outputSummary: "Assets drafted (pages, content, ads, emails)",
    });
    stages.creation.status = "completed";

    // ---------------- Stage 4: EXECUTION ----------------
    await setRunStatus({ organizationId, pipelineRunId, status: "running", currentStage: "execution" });
    await setStageStatus({ organizationId, pipelineRunId, stageId: stages.execution.id, stageKey: "execution", status: "running" });
    stages.execution.status = "running";
    await log("execution", "info", "Execution stage started");

    // Lead capture form record (bind to funnel form step)
    const formStepId = funnelStepIds["form"];
    let leadCaptureFormId: string | null = null;
    if (formStepId) {
      const { data: form, error: fErr } = await admin
        .from("lead_capture_forms" as never)
        .insert({
          organization_id: organizationId,
          campaign_id: campaignId,
          funnel_id: funnelId,
          funnel_step_id: formStepId,
          name: `Lead capture · ${input.goal}`.slice(0, 120),
          status: "draft",
          schema: {
            fields: [
              { key: "email", type: "email", label: "Email", required: true },
              { key: "name", type: "text", label: "Name", required: false },
            ],
          },
          integrations: { email_sequence: "pending_activation", notes: "bind on approval" },
          metadata: { pipeline_run_id: pipelineRunId, trace_id: traceId },
          updated_at: nowIso(),
        } as never)
        .select("id")
        .single();
      if (!fErr && form) {
        leadCaptureFormId = String((form as any).id);
        createdRecords.push({ table: "lead_capture_forms", id: leadCaptureFormId, label: "lead_capture_form" });
      } else {
        warnings.push(`lead_capture_forms insert failed: ${fErr?.message ?? "unknown"}`);
      }
    }

    // Tracking link (affiliate/client)
    const tracking = await toolOk<any>({
      ...envelopeBase,
      campaign_id: campaignId,
      tool_name: "create_tracking_link",
      input: {
        organizationId,
        destination_url: input.url,
        label: `${input.goal} · ${input.trafficSource}`.slice(0, 120),
        campaign_id: campaignId,
        utm_defaults: { utm_source: input.trafficSource, utm_campaign: `mp-${pipelineRunId.slice(0, 8)}` },
      },
    });
    createdRecords.push({ table: "affiliate_links", id: String(tracking.id), label: "tracking_link" });

    // Email sequence (connect templates)
    const sequence = await toolOk<any>({
      ...envelopeBase,
      campaign_id: campaignId,
      tool_name: "create_email_sequence",
      input: {
        organizationId,
        campaign_id: campaignId,
        name: `Pipeline sequence · ${input.goal}`.slice(0, 120),
        description: `Auto-drafted by marketing pipeline. Requires approval before activation.`,
        is_active: false,
      },
    });
    createdRecords.push({ table: "email_sequences", id: String(sequence.id), label: sequence.name });

    // Attach first 5 most recent templates for this org (best-effort)
    const { data: templates } = await admin
      .from("email_templates" as never)
      .select("id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(5);
    const templateIds = (templates ?? []).map((t: any) => String(t.id)).reverse();
    for (let i = 0; i < templateIds.length; i += 1) {
      const step = await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        tool_name: "add_email_sequence_step",
        input: {
          organizationId,
          sequence_id: String(sequence.id),
          template_id: templateIds[i],
          delay_minutes: i * 60 * 24,
        },
      });
      createdRecords.push({ table: "email_sequence_steps", id: String(step.id), label: `step_${i + 1}` });
    }

    // Automation rules (draft)
    const { data: rules, error: rErr } = await admin
      .from("automation_rules" as never)
      .insert([
        {
          organization_id: organizationId,
          campaign_id: campaignId,
          name: "On lead captured → enroll sequence (draft)",
          status: "draft",
          trigger: { type: "lead.created", source: "lead_capture_form", form_id: leadCaptureFormId },
          actions: [{ type: "email.enroll_sequence", sequence_id: String(sequence.id) }],
          metadata: { pipeline_run_id: pipelineRunId, trace_id: traceId },
          updated_at: nowIso(),
        },
      ] as never)
      .select("id");
    if (!rErr) {
      for (const rr of (rules ?? []) as any[]) createdRecords.push({ table: "automation_rules", id: String(rr.id), label: "automation_rule" });
    }

    // Approval items (high-risk)
    const approvalTool = async (approval_type: string, payload: Record<string, unknown>) => {
      const a = await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        approval_mode: "disabled",
        tool_name: "create_approval_item",
        input: {
          organizationId,
          approval_type,
          campaign_id: campaignId,
          requested_by_user_id: params.actorUserId,
          payload,
        },
      });
      approvalItems.push({ id: String(a.id), approval_type: String(a.approval_type ?? approval_type) });
      createdRecords.push({ table: "approvals", id: String(a.id), label: approval_type });
      return a;
    };

    await approvalTool("content_publishing", { reason: "Review landing/bridge + content drafts before publishing", pipeline_run_id: pipelineRunId });
    await approvalTool("email_sending", { reason: "Review sequence before activation", sequence_id: String(sequence.id), pipeline_run_id: pipelineRunId });
    await approvalTool("ads_activation", { reason: "Review ad creatives before activating ads", pipeline_run_id: pipelineRunId });
    await approvalTool("affiliate_cta_activation", { reason: "Review tracking link/CTA before activation", link_id: String(tracking.id), pipeline_run_id: pipelineRunId });

    await insertStageOutput({
      organizationId,
      pipelineRunId,
      stageId: stages.execution.id,
      outputType: "execution.output",
      content: {
        lead_capture_form_id: leadCaptureFormId,
        tracking_link_id: String(tracking.id),
        email_sequence_id: String(sequence.id),
        automation_rule_count: rules?.length ?? 0,
        approval_count: approvalItems.length,
      },
      createdRecordRefs: createdRecords,
    });

    const runNeedsApproval = input.approvalMode === "required";
    await setStageStatus({
      organizationId,
      pipelineRunId,
      stageId: stages.execution.id,
      stageKey: "execution",
      status: runNeedsApproval ? "needs_approval" : "completed",
      outputSummary: runNeedsApproval ? "Drafted execution; awaiting approvals" : "Execution drafted",
    });
    stages.execution.status = runNeedsApproval ? "needs_approval" : "completed";

    // ---------------- Stage 5: OPTIMIZATION ----------------
    await setRunStatus({
      organizationId,
      pipelineRunId,
      status: runNeedsApproval ? "needs_approval" : "running",
      currentStage: "optimization",
      warnings,
      errors,
    });

    await setStageStatus({ organizationId, pipelineRunId, stageId: stages.optimization.id, stageKey: "optimization", status: "running" });
    stages.optimization.status = "running";
    await log("optimization", "info", "Optimization stage started");

    // Analytics baseline event
    await toolOk<any>({
      ...envelopeBase,
      campaign_id: campaignId,
      tool_name: "log_analytics_event",
      input: {
        organizationId,
        event_name: "marketing_pipeline.baseline",
        source: "marketing_pipeline",
        campaign_id: campaignId,
        funnel_id: funnelId,
        metadata: { pipeline_run_id: pipelineRunId, trace_id: traceId, goal: input.goal, traffic: input.trafficSource },
      },
    });

    // Recommendation record
    const recMarkdown = `## Starting baseline\n\n- Goal: ${input.goal}\n- Audience: ${input.audience}\n- Traffic: ${input.trafficSource}\n\n## Testing plan\n\n- Test 3 hooks first\n- Test CTA copy on landing\n- Iterate top 2 creatives\n\n## Next actions\n\n- Approve drafts\n- Publish funnel\n- Activate sequence\n- Turn on ads (after approvals)`;
    const { data: rec, error: recErr } = await admin
      .from("campaign_recommendations" as never)
      .insert({
        organization_id: organizationId,
        campaign_id: campaignId,
        status: "draft",
        title: `Pipeline recommendations · ${input.goal}`.slice(0, 120),
        recommendation_markdown: recMarkdown,
        recommendation_json: {
          baseline: { goal: input.goal, audience: input.audience, trafficSource: input.trafficSource },
          tests: [{ type: "hook", count: 3 }, { type: "cta", count: 2 }, { type: "creative", count: 2 }],
        },
        created_by_agent_run_id: null,
      } as never)
      .select("id")
      .single();
    if (!recErr && rec) {
      createdRecords.push({ table: "campaign_recommendations", id: String((rec as any).id), label: "recommendation" });
    }

    await insertStageOutput({
      organizationId,
      pipelineRunId,
      stageId: stages.optimization.id,
      outputType: "optimization.output",
      content: {
        kpi_baseline: { goal: input.goal, traffic: input.trafficSource, at: nowIso() },
        testing_plan: ["Hook test", "CTA test", "Creative iteration"],
        next_actions: ["Approve drafts", "Publish funnel", "Activate email sequence", "Activate ads (after approvals)"],
      },
      createdRecordRefs: createdRecords,
    });
    await setStageStatus({
      organizationId,
      pipelineRunId,
      stageId: stages.optimization.id,
      stageKey: "optimization",
      status: "completed",
      outputSummary: "Baseline + recommendations created",
    });
    stages.optimization.status = "completed";

    const finalStatus = runNeedsApproval ? "needs_approval" : "completed";
    await setRunStatus({ organizationId, pipelineRunId, status: finalStatus, currentStage: "optimization", warnings, errors });
    await writeAuditLog({
      organizationId,
      actorUserId: params.actorUserId,
      action: "marketing_pipeline.finished",
      entityType: "marketing_pipeline_runs",
      entityId: pipelineRunId,
      metadata: { trace_id: traceId, status: finalStatus, campaign_id: campaignId },
    });

    return {
      organizationId,
      campaignId,
      pipelineRunId,
      stages: {
        research: { stageId: stages.research.id, status: stages.research.status },
        strategy: { stageId: stages.strategy.id, status: stages.strategy.status },
        creation: { stageId: stages.creation.id, status: stages.creation.status },
        execution: { stageId: stages.execution.id, status: stages.execution.status },
        optimization: { stageId: stages.optimization.id, status: stages.optimization.status },
      },
      createdRecords,
      approvalItems,
      logs,
      warnings,
      errors,
      providerMeta: { traceId, provider: input.provider },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Pipeline failed";
    errors.push(msg);
    await insertStageLog({
      organizationId,
      pipelineRunId,
      stageId: null,
      level: "error",
      message: "Pipeline failed",
      data: { error: msg },
    }).catch(() => null);
    await setRunStatus({ organizationId, pipelineRunId, status: "failed", currentStage: null, warnings, errors }).catch(() => null);
    await writeAuditLog({
      organizationId,
      actorUserId: params.actorUserId,
      action: "marketing_pipeline.failed",
      entityType: "marketing_pipeline_runs",
      entityId: pipelineRunId,
      metadata: { error: msg },
    }).catch(() => null);
    return {
      organizationId,
      campaignId,
      pipelineRunId,
      stages: {
        research: { stageId: stages.research.id, status: stages.research.status },
        strategy: { stageId: stages.strategy.id, status: stages.strategy.status },
        creation: { stageId: stages.creation.id, status: stages.creation.status },
        execution: { stageId: stages.execution.id, status: stages.execution.status },
        optimization: { stageId: stages.optimization.id, status: stages.optimization.status },
      },
      createdRecords,
      approvalItems,
      logs,
      warnings,
      errors,
      providerMeta: { traceId, provider: input.provider, failed: true },
    };
  }
}

