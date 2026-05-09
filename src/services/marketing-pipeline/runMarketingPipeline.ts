import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";
import { env } from "@/lib/env";
import { writeAuditLog } from "@/services/audit/auditService";
import { runWorkerAndPersist } from "@/services/marketing-pipeline/workerRunner";
import { scrapeUrlTextOrThrow } from "@/services/web/scrapeUrlText";
import { buildBusinessBriefUserPrompt } from "@/ai/prompts/business_brief.prompt";
import { buildLandingPageGeneratorUserPrompt } from "@/ai/prompts/landing_page_generator.prompt";
import { buildLandingVariantsUserPrompt } from "@/ai/prompts/landing_variants.prompt";
import {
  findBannedSubstring,
  hostBrandFromUrl,
  isHeroAnchored,
  isSelfBrandCampaignUrl,
  LANDING_FREQ_STOPWORDS,
  markCampaignNeedsLandingFix,
  mentionsAiWorkersPlatform,
  specificPageKeywords,
  strongTitleAnchors,
  type LandingFixReason,
} from "@/services/marketing-pipeline/landingCopyGuards";
import { buildLandingVariantBlocks, DEFAULT_LANDING_VISUAL_PRESET } from "@/services/marketing-pipeline/landingVariantBlocks";

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
    pain_points: Array.from({ length: 5 }).map((_, i) =>
      i === 0 ? `Struggling to get ${input.goal} consistently` : `Pain point ${i + 1} for ${input.audience} (${input.trafficSource})`,
    ),
    objections: Array.from({ length: 5 }).map((_, i) =>
      i === 0 ? "Is this legit / will this work for me?" : `Objection ${i + 1} before taking action`,
    ),
    hooks: Array.from({ length: 5 }).map((_, i) =>
      i === 0 ? `New ${input.audience}? Start here before you tour homes…` : `Hook ${i + 1}: ${input.goal} (${input.trafficSource})`,
    ),
    positioning_angle: "Local, practical, step-by-step guidance with clear next actions.",
    competitor_notes: ["Common promises: fast results, simple steps", "Opportunity: clarify the mechanism + build trust with specifics"],
    recommended_cta: input.mode === "affiliate" ? "Get the guide" : "Book a consult",
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

export type MarketingPipelineBodyState = {
  params: { supabase: SupabaseClient; actorUserId: string; input: RunMarketingPipelineInput };
  admin: SupabaseClient;
  input: RunMarketingPipelineInput;
  organizationId: string;
  pipelineRunId: string;
  stages: Record<MarketingPipelineStageKey, StageRow>;
  stageOrder: MarketingPipelineStageKey[];
  startStage: MarketingPipelineStageKey;
  stopAfterStage: MarketingPipelineStageKey | null;
  startIdx: number;
};

export async function beginMarketingPipelineRun(params: {
  supabase: SupabaseClient;
  actorUserId: string;
  input: RunMarketingPipelineInput;
}): Promise<MarketingPipelineBodyState> {
  const parsed = runMarketingPipelineInputSchema.safeParse(params.input);
  if (!parsed.success) throw new Error(parsed.error.message);

  const admin = createSupabaseAdminClient();
  const input = parsed.data;
  const stageOrder: MarketingPipelineStageKey[] = ["research", "strategy", "creation", "execution", "optimization"];
  const startStage = (input as any).startStage ? (String((input as any).startStage) as MarketingPipelineStageKey) : "research";
  const stopAfterStage = (input as any).stopAfterStage
    ? (String((input as any).stopAfterStage) as MarketingPipelineStageKey)
    : null;
  const startIdx = Math.max(0, stageOrder.indexOf(startStage));

  let organizationId = input.organizationId ?? "";
  if (input.organizationMode === "create") {
    const name = input.organizationName ?? "New Organization";
    const slug =
      name
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

  const persistedInput = (() => {
    const row = { ...input } as Record<string, unknown>;
    delete row.defer;
    delete row.resumePipelineRunId;
    return row;
  })();

  const { data: runRow, error: runErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .insert({
      organization_id: organizationId,
      campaign_id: (input as any).campaignId ?? null,
      provider: input.provider,
      approval_mode: input.approvalMode,
      input: persistedInput,
      status: "running",
      current_stage: startStage,
      started_at: nowIso(),
    } as never)
    .select("id")
    .single();
  if (runErr || !runRow) throw new Error(runErr?.message ?? "Failed to create pipeline run");
  const pipelineRunId = String((runRow as any).id);

  const stageKeys: MarketingPipelineStageKey[] = marketingPipelineStageKeySchema.options;
  const stages: Record<MarketingPipelineStageKey, StageRow> = {} as any;

  for (const stageKey of stageKeys) {
    const idx = stageOrder.indexOf(stageKey);
    const initialStatus: MarketingPipelineStageStatus =
      idx < startIdx ? "completed" : idx === startIdx ? "running" : "pending";
    const { data: sRow, error: sErr } = await admin
      .from("marketing_pipeline_stages" as never)
      .insert({
        organization_id: organizationId,
        pipeline_run_id: pipelineRunId,
        stage_key: stageKey,
        status: initialStatus,
        assigned_workers: stageWorkers(stageKey),
        started_at: initialStatus === "running" ? nowIso() : null,
        finished_at: initialStatus === "completed" ? nowIso() : null,
        output_summary: initialStatus === "completed" ? "Skipped (resume from later stage)" : null,
      } as never)
      .select("id,stage_key,status")
      .single();
    if (sErr || !sRow) throw new Error(sErr?.message ?? `Failed to create stage ${stageKey}`);
    stages[stageKey] = { id: String((sRow as any).id), stage_key: stageKey, status: String((sRow as any).status) as any };
  }

  return { params, admin, input, organizationId, pipelineRunId, stages, stageOrder, startStage, stopAfterStage, startIdx };
}

async function loadMarketingPipelineForResume(params: {
  supabase: SupabaseClient;
  actorUserId: string;
  input: RunMarketingPipelineInput;
}): Promise<MarketingPipelineBodyState> {
  const resumeId = params.input.resumePipelineRunId;
  if (!resumeId) throw new Error("resumePipelineRunId required");

  const admin = createSupabaseAdminClient();
  const { data: runRow, error: runErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .select("id,organization_id,campaign_id,input,status")
    .eq("id", resumeId)
    .maybeSingle();
  if (runErr || !runRow) throw new Error(runErr?.message ?? "Pipeline run not found for resume");

  const organizationId = String((runRow as any).organization_id);
  if (params.input.organizationId && String(params.input.organizationId) !== organizationId) {
    throw new Error("organizationId mismatch for resumed pipeline run");
  }

  const { data: stRows, error: stErr } = await admin
    .from("marketing_pipeline_stages" as never)
    .select("id,stage_key,status")
    .eq("pipeline_run_id", resumeId)
    .order("created_at", { ascending: true });
  if (stErr || !(stRows as any[])?.length) throw new Error(stErr?.message ?? "Missing pipeline stages");

  const stages: Record<MarketingPipelineStageKey, StageRow> = {} as any;
  for (const sk of marketingPipelineStageKeySchema.options) {
    const row = (stRows as any[]).find((r) => String(r.stage_key) === sk);
    if (!row) throw new Error(`Missing stage row: ${sk}`);
    stages[sk] = { id: String(row.id), stage_key: sk, status: String(row.status) as any };
  }

  const rawInput = (runRow as any).input;
  const merged = {
    ...(typeof rawInput === "object" && rawInput && !Array.isArray(rawInput) ? (rawInput as Record<string, unknown>) : {}),
    organizationMode: "existing" as const,
    organizationId,
    defer: undefined,
    resumePipelineRunId: undefined,
    ...(params.input.startStage ? { startStage: params.input.startStage } : {}),
    ...(params.input.stopAfterStage !== undefined && params.input.stopAfterStage !== null
      ? { stopAfterStage: params.input.stopAfterStage }
      : {}),
    ...(params.input.campaignId ? { campaignId: params.input.campaignId } : {}),
  };

  const inputParsed = runMarketingPipelineInputSchema.safeParse(merged);
  if (!inputParsed.success) throw new Error(inputParsed.error.message);
  const input = inputParsed.data;

  const stageOrder: MarketingPipelineStageKey[] = ["research", "strategy", "creation", "execution", "optimization"];
  const startStage = (input as any).startStage ? (String((input as any).startStage) as MarketingPipelineStageKey) : "research";
  const stopAfterStage = (input as any).stopAfterStage
    ? (String((input as any).stopAfterStage) as MarketingPipelineStageKey)
    : null;
  const startIdx = Math.max(0, stageOrder.indexOf(startStage));

  return {
    params: { supabase: params.supabase, actorUserId: params.actorUserId, input },
    admin,
    input,
    organizationId,
    pipelineRunId: resumeId,
    stages,
    stageOrder,
    startStage,
    stopAfterStage,
    startIdx,
  };
}

async function executeMarketingPipelineBody(state: MarketingPipelineBodyState): Promise<RunMarketingPipelineOutput> {
  const { params, admin, input, organizationId, pipelineRunId, stages, stageOrder, startStage, stopAfterStage, startIdx } = state;

  const createdRecords: Array<{ table: string; id: string; label?: string }> = [];
  const approvalItems: Array<{ id: string; approval_type?: string }> = [];
  const logs: Array<{ id: string; stage_key?: MarketingPipelineStageKey | null; level: string; message: string; at: string }> = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let campaignId: string | null = (input as any).campaignId ? String((input as any).campaignId) : null;
  let funnelId: string | null = null;
  const funnelStepIds: Record<string, string> = {};
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

  const ensureFunnelAndSteps = async (opts?: { preferredStepTypes?: string[]; funnelType?: string }) => {
    if (!campaignId) throw new Error("campaignId required");
    if (!funnelId) {
      const { data: f0 } = await admin
        .from("funnels" as never)
        .select("id,name")
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      funnelId = f0 ? String((f0 as any).id) : null;
      if (funnelId) createdRecords.push({ table: "funnels", id: funnelId, label: String((f0 as any).name ?? "Funnel") });
    }
    if (!funnelId) {
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
          metadata: { marketing_pipeline: { run_id: pipelineRunId, trace_id: traceId, resumed: true } },
        },
      });
      funnelId = String(funnel.id);
      createdRecords.push({ table: "funnels", id: funnelId, label: funnel.name });
    }

    // Public funnel routes (`/f/:campaignId`) rely on campaign.funnel_id.
    // Keep it in sync so previews never 404.
    await admin
      .from("campaigns" as never)
      .update({ funnel_id: funnelId, updated_at: nowIso() } as never)
      .eq("organization_id", organizationId)
      .eq("id", campaignId);

    const { data: steps } = await admin
      .from("funnel_steps" as never)
      .select("id,step_type,slug")
      .eq("organization_id", organizationId)
      .eq("funnel_id", funnelId)
      .limit(200);
    const srows = (steps ?? []) as any[];
    for (const s of srows) {
      if (typeof s?.step_type === "string" && s?.id) funnelStepIds[String(s.step_type)] = String(s.id);
    }

    const baseStepDefs: Array<{ name: string; step_type: string; slug: string }> = [
      { name: "Landing page", step_type: "landing", slug: "landing" },
      { name: "Bridge page", step_type: "bridge", slug: "bridge" },
      { name: "Lead capture", step_type: "form", slug: "lead" },
      { name: "Primary CTA", step_type: "cta", slug: "cta" },
      { name: "Thank you", step_type: "thank_you", slug: "thanks" },
      { name: "Nurture trigger", step_type: "email_trigger", slug: "nurture" },
      { name: "Checkout", step_type: "checkout", slug: "checkout" },
    ];
    const wanted = (opts?.preferredStepTypes ?? []).filter(Boolean);
    // Default to a ClickFunnels-style minimal public flow:
    // landing (long-form, includes inline lead form) -> thank_you.
    // Keep other step types available when explicitly requested.
    const defaultStepTypes = ["landing", "thank_you"];
    const stepDefs =
      wanted.length > 0
        ? wanted
            .map((t) => baseStepDefs.find((d) => d.step_type === t) ?? { name: t.replace(/_/g, " "), step_type: t, slug: t })
            .filter(Boolean)
        : defaultStepTypes
            .map((t) => baseStepDefs.find((d) => d.step_type === t))
            .filter((d): d is { name: string; step_type: string; slug: string } => Boolean(d));
    let stepIndex = 0;
    for (const def of stepDefs) {
      if (funnelStepIds[def.step_type]) {
        stepIndex += 1;
        continue;
      }
      const row = await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        tool_name: "add_funnel_step",
        input: {
          organizationId,
          funnel_id: funnelId,
          name: def.name,
          step_type: def.step_type,
          slug: `mp-${pipelineRunId.slice(0, 6)}-${def.slug}`,
          metadata: { marketing_pipeline: { stage: "resume", trace_id: traceId, step_index: stepIndex } },
        },
      });
      funnelStepIds[def.step_type] = String(row.id);
      createdRecords.push({ table: "funnel_steps", id: String(row.id), label: `${def.step_type}:${row.slug}` });
      stepIndex += 1;
    }

    // Ensure steps are visible to the public funnel preview routes.
    await admin
      .from("funnel_steps" as never)
      .update({ is_public: true, updated_at: nowIso() } as never)
      .eq("organization_id", organizationId)
      .eq("funnel_id", funnelId);

    if (opts?.funnelType) {
      await admin
        .from("funnels" as never)
        .update({ metadata: { marketing_pipeline: { run_id: pipelineRunId, trace_id: traceId }, funnel_type: opts.funnelType }, updated_at: nowIso() } as never)
        .eq("organization_id", organizationId)
        .eq("id", funnelId);
    }
  };

  const funnelStyleToPreferredStepTypes = (style: unknown): string[] | null => {
    const s = typeof style === "string" ? style : "";
    if (!s) return null;
    if (s === "clickfunnels_lead") return ["landing", "thank_you"];
    if (s === "bridge_lead") return ["landing", "bridge", "thank_you"];
    if (s === "application") return ["landing", "form", "thank_you"];
    if (s === "webinar") return ["landing", "form", "thank_you", "email_trigger"];
    if (s === "product_offer") return ["landing", "checkout", "thank_you"];
    return null;
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
    const runNeedsApproval = input.approvalMode === "required";
    const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
    const asRecord = (v: unknown): Record<string, unknown> =>
      v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

    // ---------------- Stage 1: RESEARCH ----------------
    // URL scrape/extraction (hard-fail if insufficient content)
    await log("research", "info", "URL scrape started", { url: input.url });
    const scraped = await scrapeUrlTextOrThrow({ url: input.url, minChars: 500, timeoutMs: 20000 });
    await log("research", "info", "URL scrape complete", {
      url: input.url,
      finalUrl: scraped.finalUrl,
      title: scraped.title,
      contentChars: scraped.contentChars,
    });

    let research = stubResearch(input) as Record<string, unknown>;
    if (startStage === "research") {
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
      input: { url: input.url, content: scraped.contentText, goal: input.goal, audience: input.audience, trafficSource: input.trafficSource, notes: input.notes ?? null },
      schemaHint: "Return JSON with keys: offer_summary, pain_points[], objections[], mechanism, cta_recommendations{primary,secondary}.",
      prompt: `Analyze URL=${input.url}.\nMode=${input.mode}.\nAudience=${input.audience}.\nGoal=${input.goal}.\nTraffic=${input.trafficSource}.\n\nReturn concrete, campaign-specific insights (no generic placeholders).`,
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
      input: { url: input.url, content: scraped.contentText, goal: input.goal, audience: input.audience, trafficSource: input.trafficSource },
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
      input: { url: input.url, content: scraped.contentText, audience: input.audience, goal: input.goal },
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
      input: { url: input.url, content: scraped.contentText, offer: offer.output, ads: ads.output, competitors: comp.output },
      schemaHint: "Return JSON with keys: headline_options[], section_outline[], cta_plan[], notes[].",
      prompt: `Create landing page analysis for traffic=${input.trafficSource} goal=${input.goal}.`,
      fallback: { provider_mode: "stub" },
    });

    // Flatten into the UI contract so Research card is never empty.
    const offerOut = asRecord(offer.output);
    const adsOut = asRecord(ads.output);
    const compOut = asRecord(comp.output);
    const ctaRec = asRecord(offerOut.cta_recommendations);
    const pain = asStringArray(offerOut.pain_points).filter(Boolean).slice(0, 5);
    const obj = asStringArray(offerOut.objections).filter(Boolean).slice(0, 5);
    const hooks = [...asStringArray(adsOut.hook_starters), ...asStringArray((offerOut as any).hook_opportunities)]
      .filter(Boolean)
      .slice(0, 5);
    const competitorNotes = [
      ...asStringArray(compOut.competitor_angle_themes),
      ...asStringArray(compOut.differentiation_opportunities),
      ...asStringArray(compOut.risk_notes),
    ]
      .filter(Boolean)
      .slice(0, 8);

    research = {
      offer_summary: typeof offerOut.offer_summary === "string" ? offerOut.offer_summary : String(researchFallback.offer_summary),
      target_audience: input.audience,
      pain_points: pain.length ? pain : (researchFallback as any).pain_points,
      buyer_objections: obj.length ? obj : (researchFallback as any).objections,
      hooks: hooks.length ? hooks : (researchFallback as any).hooks,
      positioning_angle:
        typeof (offerOut as any).positioning_angle === "string"
          ? String((offerOut as any).positioning_angle)
          : typeof (compOut as any).positioning_angle === "string"
            ? String((compOut as any).positioning_angle)
            : String((researchFallback as any).positioning_angle),
      competitor_notes: competitorNotes.length ? competitorNotes : (researchFallback as any).competitor_notes,
      recommended_cta:
        typeof ctaRec.primary === "string"
          ? String(ctaRec.primary)
          : typeof ctaRec.secondary === "string"
            ? String(ctaRec.secondary)
            : String((researchFallback as any).recommended_cta),
      // Keep raw bundles for later stages/debugging.
      raw: { offer: offer.output, ads: ads.output, competitors: comp.output, landing: lp.output },
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
      if (stopAfterStage === "research") {
        await setRunStatus({ organizationId, pipelineRunId, status: "completed", currentStage: "research" });
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
        };
      }
    } else {
      await log("research", "info", "Research stage skipped (resume)", { startStage });
    }

    // ---------------- Stage 2: STRATEGY ----------------
    let strategy = stubStrategy(input, research) as Record<string, unknown>;
    if (startIdx <= stageOrder.indexOf("strategy")) {
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
      strategy = { head: head.output, brand: brand.output, plan: planner.output } as Record<string, unknown>;
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

      // Create campaign if needed, then ensure funnel+steps
      if (!campaignId) {
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
        await admin
          .from("marketing_pipeline_runs" as never)
          .update({ campaign_id: campaignId, updated_at: nowIso() } as never)
          .eq("organization_id", organizationId)
          .eq("id", pipelineRunId);
      }

      const funnelPlan = asRecord(asRecord(head.output).funnel_plan);
      const preferredFromStyle = funnelStyleToPreferredStepTypes((input as any).funnelStyle);
      const preferredFromPlan = Array.isArray(funnelPlan.steps) ? (funnelPlan.steps as unknown[]).filter((x): x is string => typeof x === "string") : [];
      const preferred = (preferredFromStyle?.length ? preferredFromStyle : preferredFromPlan) ?? [];
      const funnelType = typeof funnelPlan.type === "string" ? funnelPlan.type : undefined;
      await ensureFunnelAndSteps({ preferredStepTypes: preferred, funnelType });

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
      if (stopAfterStage === "strategy") {
        await setRunStatus({ organizationId, pipelineRunId, status: "completed", currentStage: "strategy" });
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
        };
      }
    } else {
      if (!campaignId) throw new Error("campaignId required to resume from stage > strategy");
      await ensureFunnelAndSteps();
      await log("strategy", "info", "Strategy stage skipped (resume)", { startStage, campaignId, funnelId });
    }

    // ---------------- Stage 3: CREATION ----------------
    if (startIdx <= stageOrder.indexOf("creation")) {
      await setRunStatus({ organizationId, pipelineRunId, status: "running", currentStage: "creation" });
      await setStageStatus({ organizationId, pipelineRunId, stageId: stages.creation.id, stageKey: "creation", status: "running" });
      stages.creation.status = "running";
      await log("creation", "info", "Creation stage started");

      if (!campaignId) throw new Error("Missing campaignId in creation stage");
      await ensureFunnelAndSteps();
      if (!campaignId || !funnelId) throw new Error("Missing campaign/funnel in creation stage");

    // Run creation workers (real agent_runs + outputs)
    const creationContext = {
      url: input.url,
      mode: input.mode,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      research,
      strategy,
    };

    const creativeDirector = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "creation",
      workerKey: "creative_director",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: creationContext,
      schemaHint:
        "Return JSON with keys: creative_brief{angles[],tone,do_dont[]}, hook_themes[], quality_checks[].",
      prompt: `Create creative direction for ${input.trafficSource} to reach ${input.audience} and achieve ${input.goal}.`,
      fallback: { provider_mode: "stub" },
    });

    const copywriter = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "creation",
      workerKey: "copywriter",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { ...creationContext, creative: creativeDirector.output },
      schemaHint:
        "Return JSON with keys: landing_markdown, bridge_markdown, faq[{q,a}], bullets[].",
      prompt: `Write landing + bridge copy (markdown). Keep it specific, no unverifiable claims.`,
      fallback: {
        landing_markdown: `# ${input.goal}\n\nDraft landing copy for ${input.audience}.\n\n- Promise\n- Proof placeholders\n- CTA`,
        bridge_markdown: `# Bridge\n\nStory → mechanism → CTA for ${input.url}.`,
        faq: [],
        bullets: [],
      },
    });

    const scriptwriter = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "creation",
      workerKey: "scriptwriter",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { ...creationContext, creative: creativeDirector.output, copy: copywriter.output },
      schemaHint:
        "Return JSON with keys: hooks[20], scripts[10]{title,hook,beats[],cta,on_screen_text[]}, captions[10], post_ideas[10].",
      prompt: `Generate campaign-specific content for URL=${input.url}.\nAudience=${input.audience}.\nGoal=${input.goal}.\nTraffic=${input.trafficSource}.\n\nRequirements:\n- No generic placeholders.\n- Use niche/business context implied by the URL.\n- Hooks must sound like real ad/social intros.\n- Provide captions + post ideas too.`,
      fallback: {
        hooks: Array.from({ length: 20 }).map((_, i) => `Hook ${i + 1}: ${input.audience} — ${input.goal}`),
        scripts: Array.from({ length: 10 }).map((_, i) => ({
          title: `Script ${i + 1}`,
          hook: `Hook ${i + 1}: ${input.audience} — ${input.goal}`,
          beats: ["Problem", "Mechanism", "CTA"],
          cta: "Click to learn more",
          on_screen_text: [],
        })),
        captions: Array.from({ length: 10 }).map((_, i) => `Caption ${i + 1} for ${input.audience}: ${input.goal}`),
        post_ideas: Array.from({ length: 10 }).map((_, i) => `Post idea ${i + 1}: ${input.goal} (${input.trafficSource})`),
      },
    });

    const adDesigner = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "creation",
      workerKey: "ad_designer",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { ...creationContext, hooks: scriptwriter.output, creative: creativeDirector.output },
      schemaHint:
        "Return JSON with keys: ad_creatives[10]{headline,primary_text,script_markdown,format,platform}.",
      prompt: `Create 10 ad creatives for ${input.trafficSource} based on hooks/scripts. Draft-safe.`,
      fallback: {
        ad_creatives: Array.from({ length: 10 }).map((_, i) => ({
          headline: `Ad ${i + 1}: ${input.goal}`,
          primary_text: `For ${input.audience}: ${input.goal}`,
          script_markdown: `## Script ${i + 1}\n\nHook: ${input.audience} — ${input.goal}\n\nBody...\n\nCTA...`,
          format: "short_video",
          platform: input.trafficSource,
        })),
      },
    });

    const emailWriter = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "creation",
      workerKey: "email_writer",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { ...creationContext, copy: copywriter.output, creative: creativeDirector.output },
      schemaHint:
        "Return JSON with keys: templates[5]{name,subject,body_markdown,purpose}. Purposes in order: welcome_delivery, pain_education, trust_builder, objection_handling, primary_cta.",
      prompt:
        `Write 5 campaign-specific emails for URL=${input.url}.\nAudience=${input.audience}.\nGoal=${input.goal}.\nTraffic=${input.trafficSource}.\n\nRequirements:\n- No placeholders (no generic SaaS/community language).\n- Keep it specific to the business context from the URL.\n- Each email must match the required purpose order and include a clear CTA aligned to the funnel.\n- Use a warm, local-trust tone if the niche is service/real estate.\n`,
      fallback: {
        templates: Array.from({ length: 5 }).map((_, i) => ({
          name: `Pipeline email ${i + 1} · ${input.goal}`,
          subject: `Step ${i + 1}: ${input.goal}`,
          body_markdown: `Draft email ${i + 1} for ${input.audience}.\n\nGoal: ${input.goal}\nURL: ${input.url}`,
          purpose:
            i === 0
              ? "welcome_delivery"
              : i === 1
                ? "pain_education"
                : i === 2
                  ? "trust_builder"
                  : i === 3
                    ? "objection_handling"
                    : "primary_cta",
        })),
      },
    });

    // ---------------- Direct-response landing generator (strict JSON, hard-fail on generic output) ----------------
    // Stage A: extract a grounded business brief (names/locations/offers/terms) from the scrape.
    const briefRun = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "creation",
      workerKey: "business_brief",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { url: input.url, content: scraped.contentText, goal: input.goal, audience: input.audience, trafficSource: input.trafficSource },
      schemaHint:
        "Return STRICT JSON: {business_name|null,person_name|null,locations[],offer_summary,offers[],service_lines[],audience_signals[],proof{...},cta_verbs_on_site[],key_terms[],forbidden_positioning[]}. No inventions.",
      prompt: buildBusinessBriefUserPrompt({
        url: input.url,
        content: scraped.contentText,
        goal: input.goal,
        audience: input.audience,
        trafficSource: input.trafficSource,
      }),
      fallback: {},
    });
    const businessBrief = asRecord(briefRun.output);
    const briefName = String(businessBrief.business_name ?? "").trim();
    const briefPerson = String(businessBrief.person_name ?? "").trim();
    const briefOffer = String(businessBrief.offer_summary ?? "").trim();
    const briefTerms = Array.isArray(businessBrief.key_terms)
      ? (businessBrief.key_terms as unknown[])
          .filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
          .map((t) => t.trim())
      : [];
    if (!(briefRun.meta as any)?.used) {
      await log("creation", "warn", "Business brief model output not used", { url: input.url });
    }
    // Brief must give us at least one strong noun anchor (name/person) plus some terms.
    if ((!briefName && !briefPerson) || !briefOffer || briefTerms.length < 8) {
      await log("creation", "error", "Business brief insufficient", {
        business_name: briefName || null,
        person_name: briefPerson || null,
        offer_summary_len: briefOffer.length,
        key_terms_count: briefTerms.length,
      });
      if (campaignId) {
        await markCampaignNeedsLandingFix({
          admin,
          organizationId,
          campaignId,
          reason: "invalid_shape",
          detail: "Business brief insufficient (missing name/person, offer_summary, or key_terms).",
        }).catch(() => null);
      }
      throw new Error("Scraping failed — insufficient structured business info");
    }

    const hostBrand = hostBrandFromUrl(input.url);
    const strongTitleTokens = strongTitleAnchors(scraped.title, LANDING_FREQ_STOPWORDS);
    const bodyAnchorKeywords = specificPageKeywords(
      scraped.title ?? "",
      scraped.contentText.slice(0, 4000),
      LANDING_FREQ_STOPWORDS,
      16,
    );

    const validateDr = (out: Record<string, unknown>) => {
      const dr = asRecord(out);
      const drHeadline = String(dr.headline ?? "").trim();
      const drSub = String(dr.subheadline ?? "").trim();
      const drBenefits = asStringArray(dr.benefits).map((s) => String(s).trim()).filter(Boolean);
      const drSteps = asStringArray(dr.steps).map((s) => String(s).trim()).filter(Boolean);
      const drCta = String(dr.cta ?? "").trim();
      const drHook = String(dr.lead_hook ?? "").trim();
      const drTrust = String(dr.trust ?? "").trim();
      const joined = [drHeadline, drSub, drCta, drHook, drTrust, ...drBenefits, ...drSteps].join(" ");
      let bannedMatch = findBannedSubstring(joined);
      if (!bannedMatch && !isSelfBrandCampaignUrl(input.url) && mentionsAiWorkersPlatform(joined)) {
        bannedMatch = "ai_workers_platform_on_client_campaign";
      }
      const heroAnchored = isHeroAnchored({
        headline: drHeadline,
        subheadline: drSub,
        hostBrand,
        strongTitleTokens,
      });
      const bodyJoined = [drCta, drHook, drTrust, ...drBenefits, ...drSteps].join(" ").toLowerCase();
      const bodyAnchored =
        bodyAnchorKeywords.length === 0
          ? true
          : bodyAnchorKeywords.some((k) => bodyJoined.includes(k.toLowerCase()));
      const anchored = heroAnchored && bodyAnchored;
      const validShape = Boolean(drHeadline) && Boolean(drSub) && Boolean(drCta) && drBenefits.length >= 3 && drSteps.length >= 2;
      return {
        validShape,
        anchored,
        bannedMatch,
        joined,
        drHeadline,
        drSub,
        drCta,
      };
    };

    const basePrompt = buildLandingPageGeneratorUserPrompt({
      url: input.url,
      content: scraped.contentText,
      businessBrief,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      urlResearch: research,
      funnelStrategy: null,
    });

    const runLanding = async (extraRule: string | null) => {
      const prompt = extraRule
        ? `${basePrompt}\n\nREWRITE_RULE:\n${extraRule}\n`
        : basePrompt;
      return await runWorkerAndPersist({
        organizationId,
        campaignId,
        pipelineRunId,
        stageKey: "creation",
        workerKey: "landing_page_generator",
        actorUserId: params.actorUserId,
        provider: input.provider,
        input: { url: input.url, content: scraped.contentText, goal: input.goal, audience: input.audience, trafficSource: input.trafficSource, rewrite_rule: extraRule },
        schemaHint:
          "Return STRICT JSON: {headline,subheadline,benefits[4],steps[3],cta,lead_hook,trust}. Do not use generic phrases.",
        prompt,
        fallback: {},
      });
    };

    const failLanding = async (reason: LandingFixReason, detail: string) => {
      console.warn("[landing] dr-failed", { url: input.url, reason, detail, campaignId });
      if (campaignId) {
        await markCampaignNeedsLandingFix({ admin, organizationId, campaignId, reason, detail });
      }
      const message =
        reason === "banned_phrase"
          ? `Generic output detected — banned phrases present: "${detail}"`
          : reason === "placeholder"
            ? `Placeholder text detected — "${detail}"`
            : reason === "not_anchored"
              ? `Generic output detected — not anchored to scraped content${detail ? `: ${detail}` : ""}`
              : reason === "model_unused"
                ? "Landing generation failed — model output not used"
                : "AI output invalid";
      throw new Error(message);
    };

    console.info("[landing] dr-start", {
      url: input.url,
      hostBrand,
      strongTitleTokens,
      contentChars: scraped.contentText.length,
    });

    let drLanding = await runLanding(null);
    if (!(drLanding.meta as any)?.used) await failLanding("model_unused", "first attempt");
    let verdict = validateDr(drLanding.output);
    console.info("[landing] dr-attempt", {
      attempt: 1,
      validShape: verdict.validShape,
      anchored: verdict.anchored,
      bannedMatch: verdict.bannedMatch,
      headline: verdict.drHeadline,
    });

    for (let attempt = 2; attempt <= 3; attempt++) {
      if (verdict.validShape && verdict.anchored && !verdict.bannedMatch) break;
      const reason = !verdict.validShape ? "invalid_shape" : verdict.bannedMatch ? "banned_phrase" : "not_anchored";
      await log("creation", "warn", "Landing copy needs rewrite", {
        attempt,
        reason,
        banned_match: verdict.bannedMatch,
        headline: verdict.drHeadline,
        cta: verdict.drCta,
      });
      const rule =
        reason === "banned_phrase" && verdict.bannedMatch
          ? verdict.bannedMatch === "ai_workers_platform_on_client_campaign"
            ? `The campaign URL is a CLIENT website, not AiWorkers. Remove ALL references to "AiWorkers". Headline and subheadline MUST include "${hostBrand ?? "the hostname brand"}" or a distinctive product/person name from content_excerpt.`
            : `You included the banned generic phrase "${verdict.bannedMatch}". Rewrite the JSON to remove it and replace with specific language from content_excerpt. Do NOT include that phrase anywhere.`
          : reason === "not_anchored"
            ? `Your headline/subheadline must mention the real brand from the URL (use "${hostBrand ?? "brand from URL"}") OR a distinctive product name from content_excerpt. Do not write generic "local business + AI" templates.`
            : "Rewrite to fully comply with required_json_shape and constraints. Use concrete, specific language from content_excerpt.";
      drLanding = await runLanding(rule);
      if (!(drLanding.meta as any)?.used) await failLanding("model_unused", `retry attempt ${attempt}`);
      verdict = validateDr(drLanding.output);
      console.info("[landing] dr-attempt", {
        attempt,
        validShape: verdict.validShape,
        anchored: verdict.anchored,
        bannedMatch: verdict.bannedMatch,
        headline: verdict.drHeadline,
      });
    }

    if (!verdict.validShape) await failLanding("invalid_shape", "missing required fields after retries");
    if (verdict.bannedMatch) await failLanding("banned_phrase", String(verdict.bannedMatch));
    if (!verdict.anchored) await failLanding("not_anchored", `${verdict.drHeadline} / ${verdict.drSub ?? ""}`.trim());

    const variantTextsJoined = (v: Record<string, unknown>) => {
      const bits: string[] = [];
      bits.push(String(v.headline ?? ""), String(v.subheadline ?? ""), String(v.ctaText ?? ""), String(v.trustLine ?? ""));
      const finalCta = asRecord(v.finalCTA);
      bits.push(String(finalCta.headline ?? ""), String(finalCta.subheadline ?? ""), String(finalCta.ctaText ?? ""));
      const benefits = Array.isArray(v.benefits) ? (v.benefits as unknown[]).map((x) => asRecord(x)) : [];
      for (const b of benefits) {
        bits.push(String(b.title ?? ""), String(b.description ?? ""));
      }
      const steps = Array.isArray(v.steps) ? (v.steps as unknown[]).map((x) => asRecord(x)) : [];
      for (const s of steps) bits.push(String(s.title ?? ""), String(s.description ?? ""));
      return bits.join(" ");
    };

    const validateVariantsShape = (variantsRoot: Record<string, unknown>) => {
      const varsRaw = variantsRoot.variants;
      if (!Array.isArray(varsRaw) || varsRaw.length < 3) return { ok: false as const, reason: "invalid_shape" };
      for (const raw of varsRaw) {
        const v = asRecord(raw);
        const joined = variantTextsJoined(v);
        let bannedMatch = findBannedSubstring(joined);
        if (!bannedMatch && !isSelfBrandCampaignUrl(input.url) && mentionsAiWorkersPlatform(joined)) {
          bannedMatch = "ai_workers_platform_on_client_campaign";
        }
        if (bannedMatch) return { ok: false as const, reason: "banned", bannedMatch, variantKey: String(v.variantKey ?? "") };
        const hl = String(v.headline ?? "").trim();
        const sub = String(v.subheadline ?? "").trim();
        if (!isHeroAnchored({ headline: hl, subheadline: sub, hostBrand, strongTitleTokens })) {
          return { ok: false as const, reason: "not_anchored", variantKey: String(v.variantKey ?? "") };
        }
        const bodyOnly = joined.replace(hl, " ").replace(sub, " ").toLowerCase();
        const bodyAnchored =
          bodyAnchorKeywords.length === 0 ||
          bodyAnchorKeywords.some((k) => bodyOnly.includes(k.toLowerCase()));
        if (!bodyAnchored) return { ok: false as const, reason: "body_not_anchored", variantKey: String(v.variantKey ?? "") };
      }
      return { ok: true as const };
    };

    const baseVariantsPrompt = buildLandingVariantsUserPrompt({
      url: input.url,
      content: scraped.contentText,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      baseLanding: drLanding.output,
    });

    const runVariants = async (extra: string | null) => {
      const prompt = extra ? `${baseVariantsPrompt}\n\nREWRITE_RULE:\n${extra}\n` : baseVariantsPrompt;
      return await runWorkerAndPersist({
        organizationId,
        campaignId,
        pipelineRunId,
        stageKey: "creation",
        workerKey: "landing_variants",
        actorUserId: params.actorUserId,
        provider: input.provider,
        input: {
          url: input.url,
          content: scraped.contentText,
          goal: input.goal,
          audience: input.audience,
          trafficSource: input.trafficSource,
          base: drLanding.output,
          rewrite_rule: extra,
        },
        schemaHint:
          "Return STRICT JSON: {variants:[{variantKey,angle,headline,subheadline,ctaText,benefits[{title,description}],steps[{title,description}],trustLine,finalCTA{headline,subheadline,ctaText}}]}",
        prompt,
        fallback: {},
      });
    };

    const failVariants = async (reason: LandingFixReason, detail: string) => {
      console.warn("[landing] variants-failed", { url: input.url, reason, detail, campaignId });
      if (campaignId) {
        await markCampaignNeedsLandingFix({ admin, organizationId, campaignId, reason, detail });
      }
      const message =
        reason === "banned_phrase"
          ? `Generic output detected in variants — banned phrases present: "${detail}"`
          : reason === "not_anchored"
            ? `Generic output detected — variant headlines not anchored to the real brand/page${detail ? `: ${detail}` : ""}`
            : reason === "body_not_anchored"
              ? "Generic output detected — variant body copy not anchored to scraped content"
              : reason === "model_unused"
                ? "Landing variants failed — model output not used"
                : "Landing variants failed — invalid shape";
      throw new Error(message);
    };

    let variantsOut = await runVariants(null);
    if (!(variantsOut.meta as any)?.used) await failVariants("model_unused", "first attempt");
    let variantsVerdict = validateVariantsShape(asRecord(variantsOut.output));
    console.info("[landing] variants-attempt", { attempt: 1, verdict: variantsVerdict });

    for (let vAttempt = 2; vAttempt <= 4; vAttempt++) {
      if (variantsVerdict.ok) break;
      const rule =
        variantsVerdict.reason === "banned"
          ? variantsVerdict.bannedMatch === "ai_workers_platform_on_client_campaign"
            ? `CLIENT URL — remove ALL "AiWorkers" references from every variant. Headlines/subheadlines MUST name "${hostBrand ?? "the client brand"}" or a person/product from content_excerpt. Bodies must use concrete terms from content_excerpt.`
            : `Remove generic phrase "${variantsVerdict.bannedMatch}" from ALL variants. Use wording grounded in content_excerpt only. Every headline/subheadline must include "${hostBrand}" or a distinctive product term from the page.`
          : variantsVerdict.reason === "not_anchored"
            ? `Each variant headline+subheadline must include the brand "${hostBrand}" or a distinctive term from the page title. No generic "local business + AI" copy.`
            : `Each variant body (benefits/steps/trust) must reference at least one concrete term from content_excerpt (product, place, program, service line). Variant: ${variantsVerdict.variantKey}.`;
      await log("creation", "warn", "Landing variants need rewrite", { attempt: vAttempt, ...variantsVerdict });
      variantsOut = await runVariants(rule);
      if (!(variantsOut.meta as any)?.used) await failVariants("model_unused", `retry attempt ${vAttempt}`);
      variantsVerdict = validateVariantsShape(asRecord(variantsOut.output));
      console.info("[landing] variants-attempt", { attempt: vAttempt, verdict: variantsVerdict });
    }

    if (!variantsVerdict.ok) {
      if (variantsVerdict.reason === "banned") {
        await failVariants("banned_phrase", String(variantsVerdict.bannedMatch ?? ""));
      } else if (variantsVerdict.reason === "not_anchored") {
        await failVariants("not_anchored", `variant=${variantsVerdict.variantKey ?? "?"}`);
      } else if (variantsVerdict.reason === "body_not_anchored") {
        await failVariants("body_not_anchored", `variant=${variantsVerdict.variantKey ?? "?"}`);
      } else {
        await failVariants("invalid_shape", "verdict=invalid_shape");
      }
    }

    const pageDesigner = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "creation",
      workerKey: "page_designer",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { ...creationContext, url: input.url, content: scraped.contentText, copy: copywriter.output },
      schemaHint:
        "Return JSON with keys: url_analysis{business_type,target_audience,main_offer,tone,classification}, funnel{type,steps[]}, landing_variants[3]{variantKey,angle,headline,subheadline,ctaText,benefits[{title,description}],steps[{title,description}],trustLine,finalCTA{headline,subheadline,ctaText}}, bridge{headline,subheadline,cta,sections[]}, thank_you{headline,subheadline,cta,sections[]}. landing_variants.variantKey must be exactly: direct_response, premium_trust, speed_convenience. sections[] items remain flexible blocks for bridge/thank_you.",
      prompt:
        `Build a universal funnel package for URL=${input.url}.\nGoal=${input.goal}.\nAudience=${input.audience}.\nTraffic=${input.trafficSource}.\n\nRules:\n- Do NOT hardcode any niche.\n- First analyze the URL to infer business type, offer, tone, and classification (service/SaaS/ecommerce/affiliate/info product).\n- Choose an appropriate funnel type + step sequence.\n- Produce 3 landing variants: problem-focused, benefit-focused, urgency/offer.\n- Output structured JSON only.`,
      // EMPTY FALLBACK: never inject template marketing copy. If the AI provider returns nothing,
      // downstream code marks the campaign as needs_generation_fix instead of writing fake variants.
      fallback: {
        url_analysis: {
          business_type: "",
          target_audience: "",
          main_offer: "",
          tone: "",
          classification: "",
        },
        funnel: { type: "", steps: [] as string[] },
        landing_variants: [] as unknown[],
        bridge: { headline: "", subheadline: "", cta: "", sections: [] as unknown[] },
        thank_you: { headline: "", subheadline: "", cta: "", sections: [] as unknown[] },
      },
    });

    const hooks = asStringArray(asRecord(scriptwriter.output).hooks);
    const scriptsRaw = Array.isArray(asRecord(scriptwriter.output).scripts) ? (asRecord(scriptwriter.output).scripts as unknown[]) : [];
    const scripts = scriptsRaw
      .map((s) => asRecord(s))
      .map((s, idx) => ({
        title: typeof s.title === "string" ? s.title : `Script ${idx + 1}`,
        hook: typeof s.hook === "string" ? s.hook : hooks[idx] ?? "",
        beats: asStringArray(s.beats),
        cta: typeof s.cta === "string" ? s.cta : "Click to learn more",
        on_screen_text: asStringArray(s.on_screen_text),
      }))
      .slice(0, 10);

    const landingCopy = String(asRecord(copywriter.output).landing_markdown ?? "");
    const bridgeCopy = String(asRecord(copywriter.output).bridge_markdown ?? "");

    // Persist real content_assets rows (so Content card is non-zero and campaign-specific)
    const captions = asStringArray(asRecord(scriptwriter.output).captions);
    const postIdeas = asStringArray(asRecord(scriptwriter.output).post_ideas);

    const contentRows: Array<Record<string, unknown>> = [];
    // 10 hooks as individual rows
    hooks.slice(0, 10).forEach((h, i) => {
      contentRows.push({
        organization_id: organizationId,
        campaign_id: campaignId,
        funnel_id: funnelId,
        title: `Hook ${i + 1} · ${input.trafficSource}`.slice(0, 120),
        status: "draft",
        angles: [h],
        script_markdown: null,
        captions: [],
        metadata: {
          pipeline_run_id: pipelineRunId,
          trace_id: traceId,
          type: "hook",
          platform: input.trafficSource,
          hook: h,
          cta: typeof (research as any)?.recommended_cta === "string" ? String((research as any).recommended_cta) : undefined,
          worker_run_id: scriptwriter.runId,
        },
        updated_at: nowIso(),
      });
    });
    // 5 scripts
    scripts.slice(0, 5).forEach((s) => {
      contentRows.push({
        organization_id: organizationId,
        campaign_id: campaignId,
        funnel_id: funnelId,
        title: `${s.title}`.slice(0, 120),
        status: "draft",
        angles: [s.hook].filter(Boolean),
        script_markdown: `## ${s.title}\n\nHook: ${s.hook}\n\nBeats:\n- ${s.beats.join("\n- ")}\n\nCTA: ${s.cta}`.trim(),
        captions: [],
        metadata: {
          pipeline_run_id: pipelineRunId,
          trace_id: traceId,
          type: "short_video_script",
          platform: input.trafficSource,
          hook: s.hook,
          cta: s.cta,
          worker_run_id: scriptwriter.runId,
        },
        updated_at: nowIso(),
      });
    });
    // 5 captions
    captions.slice(0, 5).forEach((c, i) => {
      contentRows.push({
        organization_id: organizationId,
        campaign_id: campaignId,
        funnel_id: funnelId,
        title: `Caption ${i + 1} · ${input.trafficSource}`.slice(0, 120),
        status: "draft",
        angles: [],
        script_markdown: null,
        captions: [c],
        metadata: {
          pipeline_run_id: pipelineRunId,
          trace_id: traceId,
          type: "caption",
          platform: input.trafficSource,
          caption: c,
          worker_run_id: scriptwriter.runId,
        },
        updated_at: nowIso(),
      });
    });
    // 5 post ideas
    postIdeas.slice(0, 5).forEach((p, i) => {
      contentRows.push({
        organization_id: organizationId,
        campaign_id: campaignId,
        funnel_id: funnelId,
        title: `Post idea ${i + 1}`.slice(0, 120),
        status: "draft",
        angles: [],
        script_markdown: `Idea: ${p}`.slice(0, 1200),
        captions: [],
        metadata: {
          pipeline_run_id: pipelineRunId,
          trace_id: traceId,
          type: "post_idea",
          platform: input.trafficSource,
          idea: p,
          worker_run_id: scriptwriter.runId,
        },
        updated_at: nowIso(),
      });
    });
    // Keep landing/bridge copy rows too (useful for editors)
    contentRows.push({
      organization_id: organizationId,
      campaign_id: campaignId,
      funnel_id: funnelId,
      title: `Landing copy · ${input.goal}`.slice(0, 120),
      status: "draft",
      angles: hooks[0] ? [hooks[0]] : [],
      script_markdown: landingCopy || null,
      captions: [],
      metadata: { pipeline_run_id: pipelineRunId, trace_id: traceId, type: "landing_copy", platform: "web", worker_run_id: copywriter.runId },
      updated_at: nowIso(),
    });
    contentRows.push({
      organization_id: organizationId,
      campaign_id: campaignId,
      funnel_id: funnelId,
      title: `Bridge copy · ${input.goal}`.slice(0, 120),
      status: "draft",
      angles: hooks[1] ? [hooks[1]] : [],
      script_markdown: bridgeCopy || null,
      captions: [],
      metadata: { pipeline_run_id: pipelineRunId, trace_id: traceId, type: "bridge_copy", platform: "web", worker_run_id: copywriter.runId },
      updated_at: nowIso(),
    });

    const createdContentAssetIds: string[] = [];
    const { data: contentInserted, error: contentErr } = await admin
      .from("content_assets" as never)
      .insert(contentRows as never)
      .select("id,title");
    if (!contentErr) {
      for (const r of (contentInserted ?? []) as any[]) {
        createdContentAssetIds.push(String(r.id));
        createdRecords.push({ table: "content_assets", id: String(r.id), label: String(r.title ?? "content_asset") });
      }
    } else {
      warnings.push(`content_assets insert failed (kept going): ${contentErr.message}`);
      await log("creation", "warn", "Failed to insert content_assets (non-fatal)", { error: contentErr.message });
    }

    // Landing + bridge pages (DB records) and funnel step render data
    const landingStepId = funnelStepIds["landing"];
    const bridgeStepId = funnelStepIds["bridge"];
    if (landingStepId) {
      const variantsRaw = Array.isArray(asRecord(variantsOut.output).variants)
        ? (asRecord(variantsOut.output).variants as unknown[])
        : Array.isArray(asRecord(pageDesigner.output).landing_variants)
          ? (asRecord(pageDesigner.output).landing_variants as unknown[])
          : [];
      const variants = variantsRaw.length ? variantsRaw.slice(0, 3).map((v) => asRecord(v)) : [];
      // STRICT: if the AI returned no variants, do not synthesize template copy.
      // Mark the campaign as needs_generation_fix and skip the variant writer below.
      const normalizedVariants = variants;
      if (normalizedVariants.length === 0) {
        await markCampaignNeedsLandingFix({
          admin,
          organizationId,
          campaignId,
          reason: "model_unused",
          detail: "Universal funnel: AI returned zero landing_variants",
        });
        console.error("[landing] universal-funnel-empty-variants", {
          campaignId,
          message: "AI provider returned no landing variants; campaign marked needs_generation_fix",
        });
      }

      const createdLandingIds: Array<{ id: string; key: string }> = [];
      for (const v of normalizedVariants) {
        const key =
          typeof (v as any).variantKey === "string"
            ? String((v as any).variantKey)
            : typeof (v as any).key === "string"
              ? String((v as any).key)
              : "variant";
        const headlineRaw = typeof v.headline === "string" ? v.headline.trim() : "";
        const ctaRaw =
          typeof (v as any).ctaText === "string"
            ? String((v as any).ctaText).trim()
            : typeof (v as any).cta === "string"
              ? String((v as any).cta).trim()
              : "";
        // STRICT: refuse to write any landing variant without a real AI headline + cta.
        if (!headlineRaw || !ctaRaw) {
          console.warn("[landing] universal-funnel-skip-variant", {
            campaignId,
            variantKey: key,
            reason: !headlineRaw ? "missing-headline" : "missing-cta",
          });
          continue;
        }
        const title = headlineRaw;
        const desc = typeof v.subheadline === "string" ? v.subheadline : "";
        const blocks = buildLandingVariantBlocks(v as Record<string, unknown>);
        const { data: lp, error: lpErr } = await admin
          .from("landing_pages" as never)
          .insert(
            {
              organization_id: organizationId,
              funnel_step_id: landingStepId,
              title: String(title).slice(0, 120),
              description: String(desc).slice(0, 200),
              blocks,
              seo: { title: String(title).slice(0, 120) },
              updated_at: nowIso(),
              metadata: {
                variant_key: key,
                pipeline_run_id: pipelineRunId,
                trace_id: traceId,
                worker_run_id: drLanding.runId,
                debug: {
                  url: input.url,
                  final_url: scraped.finalUrl,
                  title: scraped.title,
                  content_chars: scraped.contentChars,
                  prompt_dr: buildLandingPageGeneratorUserPrompt({
                    url: input.url,
                    content: scraped.contentText,
                    goal: input.goal,
                    audience: input.audience,
                    trafficSource: input.trafficSource,
                    urlResearch: research,
                    funnelStrategy: null,
                  }),
                  response_dr: drLanding.output,
                  content_excerpt: scraped.contentText.slice(0, 2000),
                },
              },
            } as never,
          )
          .select("id")
          .single();
        if (!lpErr && lp) {
          const id = String((lp as any).id);
          createdLandingIds.push({ id, key });
          createdRecords.push({ table: "landing_pages", id, label: `landing:${key}` });

          const angle =
            typeof (v as any).angle === "string"
              ? String((v as any).angle)
              : key === "premium_trust"
                ? "premium_trust"
                : key === "speed_convenience"
                  ? "speed_convenience"
                  : "direct_response";

          await admin.from("landing_page_variants" as never).upsert(
            {
              organization_id: organizationId,
              campaign_id: campaignId,
              funnel_id: funnelId,
              funnel_step_id: landingStepId,
              variant_key: key,
              angle,
              content: {
                headline: headlineRaw,
                subheadline: desc,
                ctaText: ctaRaw,
                benefits: Array.isArray((v as any).benefits) ? (v as any).benefits : [],
                steps: Array.isArray((v as any).steps) ? (v as any).steps : [],
                trustLine: typeof (v as any).trustLine === "string" ? String((v as any).trustLine) : "",
                finalCTA: (v as any).finalCTA ?? {},
                visual_preset: DEFAULT_LANDING_VISUAL_PRESET,
                blocks,
                landing_page_id: id,
              },
              status: "draft",
              selected: key === "direct_response",
              updated_at: nowIso(),
            } as never,
            { onConflict: "organization_id,campaign_id,variant_key" },
          );
        }
      }

      // Ensure only one selected variant flag remains true.
      await admin
        .from("landing_page_variants" as never)
        .update({ selected: false, updated_at: nowIso() } as never)
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId);
      await admin
        .from("landing_page_variants" as never)
        .update({ selected: true, updated_at: nowIso() } as never)
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .eq("variant_key", "direct_response");

      console.info("[landing] variants-persisted", {
        url: input.url,
        campaignId,
        funnelId,
        funnelStepId: landingStepId,
        variantsWritten: createdLandingIds.length,
        selectedVariantKey: "direct_response",
        keys: createdLandingIds.map((x) => x.key),
      });

      const selectedKey =
        typeof (normalizedVariants[0] as any)?.variantKey === "string"
          ? String((normalizedVariants[0] as any).variantKey)
          : typeof (normalizedVariants[0] as any)?.key === "string"
            ? String((normalizedVariants[0] as any).key)
            : "direct_response";
      await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        tool_name: "update_funnel_step",
        input: {
          organizationId,
          step_id: landingStepId,
          metadata: {
            page: { kind: "structured", title: `Landing · ${input.goal}`, variant_key: selectedKey },
            variants: createdLandingIds,
          },
        },
      });
    }
    if (bridgeStepId) {
      const bridge = asRecord(asRecord(pageDesigner.output).bridge);
      const bridgeTitle = typeof bridge.headline === "string" ? bridge.headline : `Bridge · ${input.goal}`;
      const bridgeDesc = typeof bridge.subheadline === "string" ? bridge.subheadline : `Bridge page for ${input.audience}`;
      const sections = Array.isArray(bridge.sections) ? (bridge.sections as unknown[]).map((s) => asRecord(s)) : [];
      const bridgeBlocks = [
        { type: "hero", headline: bridgeTitle, subheadline: bridgeDesc, cta_label: typeof bridge.cta === "string" ? bridge.cta : "Continue" },
        ...sections.map((s) => ({
          type: String(s.type || "section"),
          title: typeof s.title === "string" ? s.title : undefined,
          bullets: Array.isArray(s.bullets) ? (s.bullets as unknown[]).filter((x): x is string => typeof x === "string") : undefined,
          body: typeof s.body === "string" ? s.body : undefined,
        })),
      ];
      const { data: bp, error: bpErr } = await admin
        .from("bridge_pages" as never)
        .upsert(
          {
            organization_id: organizationId,
            funnel_step_id: bridgeStepId,
            title: String(bridgeTitle).slice(0, 120),
            description: String(bridgeDesc).slice(0, 200),
            blocks: bridgeBlocks,
            seo: { title: String(bridgeTitle).slice(0, 120) },
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
          metadata: { page: { kind: "structured", title: `Bridge · ${input.goal}` } },
        },
      });
    }

    // Ad creatives (DB records) from Ad Designer output
    const adCreativesOut = Array.isArray(asRecord(adDesigner.output).ad_creatives)
      ? (asRecord(adDesigner.output).ad_creatives as unknown[])
      : [];
    const adRows = (adCreativesOut.length ? adCreativesOut : Array.from({ length: 10 }).map((_, i) => ({}))).slice(0, 10).map((raw, i) => {
      const a = asRecord(raw);
      const headline = typeof a.headline === "string" ? a.headline : `Ad ${i + 1}: ${input.goal}`;
      const primary_text = typeof a.primary_text === "string" ? a.primary_text : hooks[i % Math.max(1, hooks.length)] ?? `For ${input.audience}: ${input.goal}`;
      const script_markdown = typeof a.script_markdown === "string" ? a.script_markdown : (scripts[i % Math.max(1, scripts.length)]?.title ? `## ${scripts[i % scripts.length].title}\n\n${scripts[i % scripts.length].hook}` : "");
      const format = typeof a.format === "string" ? a.format : "short_video";
      const platform = typeof a.platform === "string" ? a.platform : input.trafficSource;
      return {
        organization_id: organizationId,
        campaign_id: campaignId,
        platform,
        format,
        status: "draft",
        headline: String(headline).slice(0, 120),
        primary_text: String(primary_text).slice(0, 600),
        script_markdown: String(script_markdown),
        metadata: { pipeline_run_id: pipelineRunId, trace_id: traceId, index: i, worker_run_id: adDesigner.runId },
        updated_at: nowIso(),
      };
    });
    const { data: adCreatives, error: adErr } = await admin.from("ad_creatives" as never).insert(adRows as never).select("id");
    if (!adErr) {
      for (const r of (adCreatives ?? []) as any[]) createdRecords.push({ table: "ad_creatives", id: String(r.id), label: "ad_creative" });
    } else {
      warnings.push(`ad_creatives insert failed (kept going): ${adErr.message}`);
      await log("creation", "warn", "Failed to insert ad_creatives (non-fatal)", { error: adErr.message });
    }

    // Email templates (5) from Email Writer output
    const emailTemplateIds: string[] = [];
    const templatesOut = Array.isArray(asRecord(emailWriter.output).templates) ? (asRecord(emailWriter.output).templates as unknown[]) : [];
    for (let i = 0; i < 5; i += 1) {
      const t = asRecord(templatesOut[i] ?? {});
      const name = typeof t.name === "string" ? t.name : `Pipeline email ${i + 1} · ${input.goal}`;
      const subject = typeof t.subject === "string" ? t.subject : `Step ${i + 1}: ${input.goal}`;
      const body_markdown =
        typeof t.body_markdown === "string"
          ? t.body_markdown
          : `Draft email ${i + 1} for ${input.audience}.\n\nGoal: ${input.goal}\nURL: ${input.url}`;
      const tpl = await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        tool_name: "create_email_template",
        input: {
          organizationId,
          name: String(name).slice(0, 120),
          subject: String(subject).slice(0, 120),
          body_markdown: String(body_markdown),
          status: "draft",
        },
      });
      emailTemplateIds.push(String(tpl.id));
      createdRecords.push({ table: "email_templates", id: String(tpl.id), label: tpl.name });
    }

    // Lead magnet (draft record)
    const leadMagnetName = `Lead magnet · ${input.goal}`.slice(0, 120);
    const { data: lm, error: lmErr } = await admin
      .from("lead_magnets" as never)
      .insert({
        organization_id: organizationId,
        name: leadMagnetName,
        description: `Draft lead magnet for ${input.audience} (${input.trafficSource}).`,
        storage_path: null,
        metadata: { pipeline_run_id: pipelineRunId, trace_id: traceId },
        updated_at: nowIso(),
      } as never)
      .select("id")
      .single();
    if (!lmErr && lm) createdRecords.push({ table: "lead_magnets", id: String((lm as any).id), label: leadMagnetName });

    // CTA variants (draft records; destination updated later when tracking link exists)
    const ctaRows = [
      { name: "Primary CTA", button_text: "Get the next step", destination_type: "external_url", destination_value: input.url },
      { name: "Soft CTA", button_text: "See how it works", destination_type: "external_url", destination_value: input.url },
      { name: "Proof CTA", button_text: "Show me the proof", destination_type: "external_url", destination_value: input.url },
    ];
    const { data: ctas, error: ctaErr } = await admin
      .from("cta_variants" as never)
      .insert(
        ctaRows.map((r) => ({
          organization_id: organizationId,
          funnel_id: funnelId,
          name: r.name,
          button_text: r.button_text,
          destination_type: r.destination_type,
          destination_value: r.destination_value,
          is_active: true,
          metadata: { pipeline_run_id: pipelineRunId, trace_id: traceId },
          updated_at: nowIso(),
        })) as never,
      )
      .select("id");
    if (!ctaErr) {
      for (const r of (ctas ?? []) as any[]) createdRecords.push({ table: "cta_variants", id: String(r.id), label: "cta_variant" });
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
        worker_run_ids: {
          creative_director: creativeDirector.runId,
          copywriter: copywriter.runId,
          scriptwriter: scriptwriter.runId,
          ad_designer: adDesigner.runId,
          email_writer: emailWriter.runId,
          page_designer: pageDesigner.runId,
        },
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
      if (stopAfterStage === "creation") {
        await setRunStatus({ organizationId, pipelineRunId, status: "completed", currentStage: "creation" });
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
        };
      }
    } else {
      if (!campaignId) throw new Error("campaignId required to resume from stage > creation");
      await ensureFunnelAndSteps();
      await log("creation", "info", "Creation stage skipped (resume)", { startStage, campaignId, funnelId });
    }

    // ---------------- Stage 4: EXECUTION ----------------
    if (startIdx <= stageOrder.indexOf("execution")) {
      await setRunStatus({ organizationId, pipelineRunId, status: "running", currentStage: "execution" });
      await setStageStatus({ organizationId, pipelineRunId, stageId: stages.execution.id, stageKey: "execution", status: "running" });
      stages.execution.status = "running";
      await log("execution", "info", "Execution stage started");

    // Run execution workers (real agent_runs + outputs)
    const executionContext = {
      url: input.url,
      mode: input.mode,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      research,
      strategy,
      creation: {
        // minimal pointers; the worker can infer from campaign/funnel records too
        campaignId,
        funnelId,
        funnelStepIds,
      },
    };

    const trackingWorker = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "execution",
      workerKey: "tracking_worker",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: executionContext,
      schemaHint: "Return JSON with keys: utm_defaults{utm_source,utm_campaign}, label, cta_click_url_hint.",
      prompt: `Create tracking plan for ${input.trafficSource} goal=${input.goal} url=${input.url}.`,
      fallback: { utm_defaults: { utm_source: input.trafficSource, utm_campaign: `mp-${pipelineRunId.slice(0, 8)}` }, label: `${input.goal} · ${input.trafficSource}` },
    });

    const leadCaptureWorker = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "execution",
      workerKey: "lead_capture_worker",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: executionContext,
      schemaHint: "Return JSON with keys: form_schema{fields[]}, integration_draft{}.",
      prompt: `Design a lead capture form schema for audience=${input.audience} with minimal friction.`,
      fallback: {
        form_schema: {
          fields: [
            { key: "email", type: "email", label: "Email", required: true },
            { key: "name", type: "text", label: "Name", required: false },
          ],
        },
        integration_draft: { email_sequence: "pending_activation" },
      },
    });

    const emailAutomationWorker = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "execution",
      workerKey: "email_automation_worker",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: executionContext,
      schemaHint: "Return JSON with keys: sequence{name,description,is_active}, step_delays_minutes[5].",
      prompt: `Create an email automation plan: sequence name/description and 5 step delays (minutes). Keep inactive by default.`,
      fallback: { sequence: { name: `Pipeline sequence · ${input.goal}`, description: "Auto-drafted. Requires approval.", is_active: false }, step_delays_minutes: [0, 1440, 2880, 4320, 5760] },
    });

    const funnelPublisher = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "execution",
      workerKey: "funnel_publisher",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: executionContext,
      schemaHint: "Return JSON with keys: publish_checklist[], approvals_needed[].",
      prompt: "Prepare publish readiness checklist and approvals needed (do NOT publish).",
      fallback: { publish_checklist: ["Landing renders", "Bridge renders", "CTA wired"], approvals_needed: ["content_publishing", "affiliate_cta_activation"] },
    });

    const performanceMarketer = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "execution",
      workerKey: "performance_marketer",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: executionContext,
      schemaHint: "Return JSON with keys: launch_checklist[], kpis[], starting_budget_assumptions{}, tests_first[].",
      prompt: `Create a launch checklist + KPIs for traffic=${input.trafficSource}. No activation.`,
      fallback: { launch_checklist: ["Approve creatives", "Publish funnel", "Enable tracking"], kpis: ["cta_clicks", "lead_submits"], tests_first: ["Hook test", "CTA test"], starting_budget_assumptions: {} },
    });

    // Lead capture form record (bind to funnel form step)
    const formStepId = funnelStepIds["form"];
    let leadCaptureFormId: string | null = null;
    if (formStepId) {
      const schema = asRecord(asRecord(leadCaptureWorker.output).form_schema);
      const integrations = asRecord(asRecord(leadCaptureWorker.output).integration_draft);
      const { data: form, error: fErr } = await admin
        .from("lead_capture_forms" as never)
        .insert({
          organization_id: organizationId,
          campaign_id: campaignId,
          funnel_id: funnelId,
          funnel_step_id: formStepId,
          name: `Lead capture · ${input.goal}`.slice(0, 120),
          status: "draft",
          schema: Object.keys(schema).length ? schema : { fields: [{ key: "email", type: "email", label: "Email", required: true }] },
          integrations: { ...integrations, notes: "bind on approval" },
          metadata: { pipeline_run_id: pipelineRunId, trace_id: traceId, worker_run_id: leadCaptureWorker.runId },
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
    const utmDefaults = asRecord(asRecord(trackingWorker.output).utm_defaults);
    const trackingLabel =
      typeof (trackingWorker.output as any)?.label === "string"
        ? String((trackingWorker.output as any).label)
        : `${input.goal} · ${input.trafficSource}`;
    const tracking = await toolOk<any>({
      ...envelopeBase,
      campaign_id: campaignId,
      tool_name: "create_tracking_link",
      input: {
        organizationId,
        destination_url: input.url,
        label: trackingLabel.slice(0, 120),
        campaign_id: campaignId,
        utm_defaults: Object.keys(utmDefaults).length ? utmDefaults : { utm_source: input.trafficSource, utm_campaign: `mp-${pipelineRunId.slice(0, 8)}` },
      },
    });
    createdRecords.push({ table: "affiliate_links", id: String(tracking.id), label: "tracking_link" });

    // Wire CTA step to affiliate click route
    const ctaStepId = funnelStepIds["cta"];
    if (ctaStepId) {
      await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        tool_name: "update_funnel_step",
        input: {
          organizationId,
          step_id: ctaStepId,
          metadata: {
            cta: {
              click_url: `/api/affiliate/click/${String(tracking.id)}`,
              affiliate_link_id: String(tracking.id),
              destination_url: input.url,
              label: trackingLabel,
            },
          },
        },
      });
    }

    // Update CTA variants to point to click route
    await admin
      .from("cta_variants" as never)
      .update({
        destination_type: "external_url",
        destination_value: `/api/affiliate/click/${String(tracking.id)}`,
        updated_at: nowIso(),
      } as never)
      .eq("organization_id", organizationId)
      .eq("funnel_id", funnelId);

    // Email sequence (connect templates)
    const seqPlan = asRecord(asRecord(emailAutomationWorker.output).sequence);
    const seqName = typeof seqPlan.name === "string" ? seqPlan.name : `Pipeline sequence · ${input.goal}`;
    const seqDesc = typeof seqPlan.description === "string" ? seqPlan.description : `Auto-drafted by marketing pipeline. Requires approval before activation.`;
    const seqActive = typeof seqPlan.is_active === "boolean" ? seqPlan.is_active : false;
    const sequence = await toolOk<any>({
      ...envelopeBase,
      campaign_id: campaignId,
      tool_name: "create_email_sequence",
      input: {
        organizationId,
        campaign_id: campaignId,
        name: String(seqName).slice(0, 120),
        description: String(seqDesc).slice(0, 400),
        is_active: Boolean(seqActive) && input.approvalMode !== "required",
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
    const delays = asStringArray(asRecord(emailAutomationWorker.output).step_delays_minutes).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0);
    const delayMinutes = delays.length ? delays : [0, 1440, 2880, 4320, 5760];
    for (let i = 0; i < templateIds.length; i += 1) {
      const step = await toolOk<any>({
        ...envelopeBase,
        campaign_id: campaignId,
        tool_name: "add_email_sequence_step",
        input: {
          organizationId,
          sequence_id: String(sequence.id),
          template_id: templateIds[i],
          delay_minutes: delayMinutes[i] ?? i * 60 * 24,
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

    await approvalTool("content_publishing", {
      reason: "Review landing/bridge + content drafts before publishing",
      pipeline_run_id: pipelineRunId,
      target_entity_type: "campaign",
      target_entity_id: campaignId,
    });
    await approvalTool("email_sending", {
      reason: "Review sequence before activation",
      sequence_id: String(sequence.id),
      pipeline_run_id: pipelineRunId,
      target_entity_type: "email_sequence",
      target_entity_id: String(sequence.id),
    });
    await approvalTool("ads_activation", {
      reason: "Review ad creatives before activating ads",
      pipeline_run_id: pipelineRunId,
      target_entity_type: "campaign",
      target_entity_id: campaignId,
    });
    await approvalTool("affiliate_cta_activation", {
      reason: "Review tracking link/CTA before activation",
      link_id: String(tracking.id),
      pipeline_run_id: pipelineRunId,
      target_entity_type: "tracking_link",
      target_entity_id: String(tracking.id),
    });

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
        worker_run_ids: {
          tracking_worker: trackingWorker.runId,
          lead_capture_worker: leadCaptureWorker.runId,
          email_automation_worker: emailAutomationWorker.runId,
          funnel_publisher: funnelPublisher.runId,
          performance_marketer: performanceMarketer.runId,
        },
        publish_checklist: asStringArray(asRecord(funnelPublisher.output).publish_checklist),
        launch_checklist: asStringArray(asRecord(performanceMarketer.output).launch_checklist),
      },
      createdRecordRefs: createdRecords,
    });
    // runNeedsApproval already computed near pipeline start
    await setStageStatus({
      organizationId,
      pipelineRunId,
      stageId: stages.execution.id,
      stageKey: "execution",
      status: runNeedsApproval ? "needs_approval" : "completed",
      outputSummary: runNeedsApproval ? "Drafted execution; awaiting approvals" : "Execution drafted",
    });
    stages.execution.status = runNeedsApproval ? "needs_approval" : "completed";
      if (stopAfterStage === "execution") {
        await setRunStatus({ organizationId, pipelineRunId, status: runNeedsApproval ? "needs_approval" : "completed", currentStage: "execution" });
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
        };
      }
    } else {
      if (!campaignId) throw new Error("campaignId required to resume from stage > execution");
      await ensureFunnelAndSteps();
      await log("execution", "info", "Execution stage skipped (resume)", { startStage, campaignId, funnelId });
    }

    // ---------------- Stage 5: OPTIMIZATION ----------------
    if (startIdx <= stageOrder.indexOf("optimization")) {
      await setRunStatus({
        organizationId,
        pipelineRunId,
        status: runNeedsApproval ? "needs_approval" : "running",
        currentStage: "optimization",
        warnings,
        errors,
      });

      await setStageStatus({
        organizationId,
        pipelineRunId,
        stageId: stages.optimization.id,
        stageKey: "optimization",
        status: "running",
      });
      stages.optimization.status = "running";
      await log("optimization", "info", "Optimization stage started");

    // Optimization workers (real agent_runs + outputs)
    const optimizationContext = {
      url: input.url,
      mode: input.mode,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      research,
      strategy,
      campaignId,
      funnelId,
      pipelineRunId,
    };

    const analyticsAnalyst = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "optimization",
      workerKey: "analytics_analyst",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: optimizationContext,
      schemaHint: "Return JSON with keys: kpi_baseline{}, event_checklist[], weekly_metrics_to_watch[].",
      prompt: `Define KPI baseline + measurement plan for goal=${input.goal} traffic=${input.trafficSource}.`,
      fallback: {
        kpi_baseline: { goal: input.goal, traffic: input.trafficSource, at: nowIso() },
        event_checklist: ["page_view", "cta_click", "lead_submit", "affiliate_click"],
        weekly_metrics_to_watch: ["CTR", "Lead CVR", "CPL", "CTA clicks"],
      },
    });

    const croWorker = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "optimization",
      workerKey: "cro_worker",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { ...optimizationContext, analytics: analyticsAnalyst.output },
      schemaHint: "Return JSON with keys: test_plan[], prioritized_changes[].",
      prompt: "Propose CRO tests for landing/bridge/form/CTA (measurable, single-variable).",
      fallback: { test_plan: ["Test 3 hooks", "Test 2 CTAs", "Test headline variants"], prioritized_changes: [] },
    });

    const reportWorker = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "optimization",
      workerKey: "report_worker",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { ...optimizationContext, analytics: analyticsAnalyst.output, cro: croWorker.output },
      schemaHint: "Return JSON with keys: weekly_report_markdown, outline_sections[].",
      prompt: "Draft a weekly report (markdown): status, KPIs, wins, blockers, next actions.",
      fallback: { weekly_report_markdown: `## Weekly report (draft)\n\nGoal: ${input.goal}\nTraffic: ${input.trafficSource}\n\n### Next actions\n- Approve drafts\n- Publish funnel\n- Activate sequence`, outline_sections: ["KPIs", "Tests", "Next actions"] },
    });

    const recommendationWorker = await runWorkerAndPersist({
      organizationId,
      campaignId,
      pipelineRunId,
      stageKey: "optimization",
      workerKey: "recommendation_worker",
      actorUserId: params.actorUserId,
      provider: input.provider,
      input: { ...optimizationContext, analytics: analyticsAnalyst.output, cro: croWorker.output, report: reportWorker.output },
      schemaHint: "Return JSON with keys: recommendations[5]{title,rationale,next_step,requires_approval:boolean}, diagnosis{}, scaling_suggestions[].",
      prompt: "Generate prioritized next actions, weak funnel diagnosis, and scaling suggestions.",
      fallback: { recommendations: [], diagnosis: {}, scaling_suggestions: [] },
    });

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

    // Recommendation record (from Recommendation Worker)
    const recMarkdown =
      typeof (recommendationWorker.output as any)?.recommendation_markdown === "string"
        ? String((recommendationWorker.output as any).recommendation_markdown)
        : `## Starting baseline\n\n- Goal: ${input.goal}\n- Audience: ${input.audience}\n- Traffic: ${input.trafficSource}\n\n## Testing plan\n\n- Test 3 hooks first\n- Test CTA copy on landing\n- Iterate top 2 creatives\n\n## Next actions\n\n- Approve drafts\n- Publish funnel\n- Activate sequence\n- Turn on ads (after approvals)`;
    const { data: rec, error: recErr } = await admin
      .from("campaign_recommendations" as never)
      .insert({
        organization_id: organizationId,
        campaign_id: campaignId,
        status: "draft",
        title: `Pipeline recommendations · ${input.goal}`.slice(0, 120),
        recommendation_markdown: recMarkdown,
        recommendation_json: {
          baseline: (analyticsAnalyst.output as any)?.kpi_baseline ?? { goal: input.goal, audience: input.audience, trafficSource: input.trafficSource },
          event_checklist: (analyticsAnalyst.output as any)?.event_checklist ?? ["page_view", "cta_click", "lead_submit", "affiliate_click"],
          tests: (croWorker.output as any)?.test_plan ?? [{ type: "hook", count: 3 }],
          recommendations: (recommendationWorker.output as any)?.recommendations ?? [],
          diagnosis: (recommendationWorker.output as any)?.diagnosis ?? {},
          scaling_suggestions: (recommendationWorker.output as any)?.scaling_suggestions ?? [],
        },
        created_by_agent_run_id: recommendationWorker.runId,
      } as never)
      .select("id")
      .single();
    if (!recErr && rec) {
      createdRecords.push({ table: "campaign_recommendations", id: String((rec as any).id), label: "recommendation" });
    }

    // Weekly report (draft artifact)
    const today = new Date();
    const day = today.getUTCDay(); // 0=Sun
    const diffToMon = (day + 6) % 7;
    const weekStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - diffToMon));
    const weekEnd = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6));
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const reportMarkdown = typeof (reportWorker.output as any)?.weekly_report_markdown === "string" ? String((reportWorker.output as any).weekly_report_markdown) : "";
    const { data: wr, error: wrErr } = await admin
      .from("weekly_reports" as never)
      .upsert(
        {
          organization_id: organizationId,
          campaign_id: campaignId,
          week_start: weekStartStr,
          week_end: weekEndStr,
          status: "draft",
          report_markdown: reportMarkdown,
          report_json: {
            pipeline_run_id: pipelineRunId,
            analytics: analyticsAnalyst.output,
            cro: croWorker.output,
            recommendations: recommendationWorker.output,
          },
          generated_by_agent_run_id: reportWorker.runId,
          updated_at: nowIso(),
        } as never,
        { onConflict: "organization_id,campaign_id,week_start" },
      )
      .select("id")
      .single();
    if (!wrErr && wr) createdRecords.push({ table: "weekly_reports", id: String((wr as any).id), label: "weekly_report" });

    await insertStageOutput({
      organizationId,
      pipelineRunId,
      stageId: stages.optimization.id,
      outputType: "optimization.output",
      content: {
        kpi_baseline: (analyticsAnalyst.output as any)?.kpi_baseline ?? { goal: input.goal, traffic: input.trafficSource, at: nowIso() },
        testing_plan: (croWorker.output as any)?.test_plan ?? ["Hook test", "CTA test"],
        next_actions: ((recommendationWorker.output as any)?.recommendations ?? [])
          .map((r: any) => String(r?.next_step ?? r?.title ?? ""))
          .filter(Boolean)
          .slice(0, 5),
        worker_run_ids: {
          analytics_analyst: analyticsAnalyst.runId,
          cro_worker: croWorker.runId,
          report_worker: reportWorker.runId,
          recommendation_worker: recommendationWorker.runId,
        },
        recommendation_id: rec ? String((rec as any).id) : null,
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
      if (stopAfterStage === "optimization") {
        await setRunStatus({ organizationId, pipelineRunId, status: runNeedsApproval ? "needs_approval" : "completed", currentStage: "optimization", warnings, errors });
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
        };
      }
    } else {
      await log("optimization", "info", "Optimization stage skipped (resume)", { startStage, campaignId });
      stages.optimization.status = "completed";
      await setStageStatus({
        organizationId,
        pipelineRunId,
        stageId: stages.optimization.id,
        stageKey: "optimization",
        status: "completed",
        outputSummary: "Skipped (resume from later stage)",
      });
    }

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

export async function runMarketingPipeline(params: {
  supabase: SupabaseClient;
  actorUserId: string;
  input: RunMarketingPipelineInput;
}): Promise<RunMarketingPipelineOutput> {
  if (params.input.resumePipelineRunId) {
    return executeMarketingPipelineBody(await loadMarketingPipelineForResume(params));
  }
  return executeMarketingPipelineBody(await beginMarketingPipelineRun(params));
}
