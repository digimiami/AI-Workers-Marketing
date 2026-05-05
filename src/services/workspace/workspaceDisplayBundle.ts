import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceDisplayBundle = {
  organizationId: string;
  campaignId: string;
  campaign: Record<string, unknown> | null;
  funnel: Record<string, unknown> | null;
  funnelSteps: Array<Record<string, unknown>>;
  landingPages: Array<Record<string, unknown>>;
  bridgePages: Array<Record<string, unknown>>;
  contentAssets: Array<Record<string, unknown>>;
  adCreatives: Array<Record<string, unknown>>;
  emailSequences: Array<Record<string, unknown>>;
  emailSequenceSteps: Array<Record<string, unknown>>;
  emailTemplates: Array<Record<string, unknown>>;
  leadCaptureForms: Array<Record<string, unknown>>;
  affiliateLinks: Array<Record<string, unknown>>;
  research: Record<string, unknown> | null;
  latestPipelineRun: { id: string; status: string; current_stage: string | null } | null;
  approvals: Array<Record<string, unknown>>;
  analyticsHints: { trackingLinks: Array<{ id: string; label: string | null; destination_url: string }> };
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function firstBlockHeadline(blocks: unknown): string {
  const arr = Array.isArray(blocks) ? blocks : [];
  for (const b of arr) {
    const o = asRecord(b);
    if (typeof o.headline === "string" && o.headline.trim()) return o.headline.trim();
    if (typeof o.title === "string" && o.title.trim()) return o.title.trim();
    if (typeof o.text === "string" && o.text.trim()) return o.text.trim().slice(0, 120);
  }
  return "";
}

/** Denormalized fields for UI cards (headline from blocks, etc.) */
export function decorateLandingForDisplay(lp: Record<string, unknown>) {
  const blocks = lp.blocks;
  const headline = firstBlockHeadline(blocks) || String(lp.title ?? "");
  const seo = asRecord(lp.seo);
  return {
    ...lp,
    display_headline: headline,
    display_subheadline: typeof lp.description === "string" ? lp.description : "",
    display_meta_title: typeof seo.meta_title === "string" ? seo.meta_title : "",
  };
}

export async function fetchWorkspaceDisplayBundle(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string,
): Promise<WorkspaceDisplayBundle> {
  const campaignRes = await supabase
    .from("campaigns" as never)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle();
  const campaign = (campaignRes.data ?? null) as Record<string, unknown> | null;

  const funnelRes = await supabase
    .from("funnels" as never)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const funnel = (funnelRes.data ?? null) as Record<string, unknown> | null;
  const funnelId = funnel && typeof funnel.id === "string" ? funnel.id : null;

  const stepsRes = funnelId
    ? await supabase
        .from("funnel_steps" as never)
        .select("id,funnel_id,step_index,name,step_type,slug,metadata,created_at,updated_at")
        .eq("organization_id", organizationId)
        .eq("funnel_id", funnelId)
        .order("step_index", { ascending: true })
        .limit(200)
    : { data: [] as never[] };
  const funnelSteps = (stepsRes.data ?? []) as Array<Record<string, unknown>>;
  const stepIds = funnelSteps.map((s) => String(s.id)).filter(Boolean);

  const [landingRes, bridgeRes, contentRes, adsRes, seqRes, formsRes, linksRes, runsRes, approvalsRes] =
    await Promise.all([
      stepIds.length
        ? supabase
            .from("landing_pages" as never)
            .select("id,funnel_step_id,title,description,blocks,seo,created_at,updated_at")
            .eq("organization_id", organizationId)
            .in("funnel_step_id", stepIds)
            .limit(50)
        : Promise.resolve({ data: [] as never[] }),
      stepIds.length
        ? supabase
            .from("bridge_pages" as never)
            .select("id,funnel_step_id,title,description,blocks,seo,created_at,updated_at")
            .eq("organization_id", organizationId)
            .in("funnel_step_id", stepIds)
            .limit(50)
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("content_assets" as never)
        .select(
          // NOTE: `content_assets` does NOT have a `platform` column (platform lives in metadata or variants).
          "id,title,status,campaign_id,funnel_id,angles,script_markdown,captions,metadata,created_at,updated_at",
        )
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("ad_creatives" as never)
        .select("id,platform,format,status,headline,primary_text,script_markdown,metadata,created_at,updated_at")
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("email_sequences" as never)
        .select("id,name,description,is_active,metadata,created_at,updated_at,campaign_id")
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("lead_capture_forms" as never)
        .select("id,name,status,schema,metadata,created_at,updated_at,funnel_id")
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("affiliate_links" as never)
        .select("id,label,destination_url,utm_defaults,is_active,created_at,updated_at")
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("marketing_pipeline_runs" as never)
        .select("id,status,current_stage,created_at")
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("approvals" as never)
        .select(
          "id,approval_type,status,created_at,updated_at,campaign_id,payload,target_entity_id,target_entity_type,action,metadata",
        )
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  const sequences = (seqRes.data ?? []) as Array<Record<string, unknown>>;
  const sequenceIds = sequences.map((s) => String(s.id)).filter(Boolean);

  const stepsQuery =
    sequenceIds.length > 0
      ? await supabase
          .from("email_sequence_steps" as never)
          .select("id,sequence_id,step_index,delay_minutes,template_id,created_at,updated_at")
          .eq("organization_id", organizationId)
          .in("sequence_id", sequenceIds)
          .order("step_index", { ascending: true })
          .limit(400)
      : { data: [] as never[] };

  const emailSequenceSteps = (stepsQuery.data ?? []) as Array<Record<string, unknown>>;
  const templateIds = Array.from(
    new Set(emailSequenceSteps.map((s) => s.template_id).filter((t): t is string => typeof t === "string")),
  );

  const templatesRes =
    templateIds.length > 0
      ? await supabase
          .from("email_templates" as never)
          .select("id,name,subject,body_markdown,metadata,created_at,updated_at")
          .eq("organization_id", organizationId)
          .in("id", templateIds)
          .limit(200)
      : { data: [] as never[] };

  let research: Record<string, unknown> | null = null;
  const latestRun = runsRes.data as { id: string; status: string; current_stage: string | null } | null;
  if (latestRun?.id) {
    const stageRes = await supabase
      .from("marketing_pipeline_stages" as never)
      .select("id")
      .eq("pipeline_run_id", latestRun.id)
      .eq("stage_key", "research")
      .maybeSingle();
    const researchStageId = stageRes.data ? String((stageRes.data as { id: string }).id) : null;
    if (researchStageId) {
      const outRes = await supabase
        .from("marketing_pipeline_stage_outputs" as never)
        .select("content,created_at")
        .eq("stage_id", researchStageId)
        .order("created_at", { ascending: false })
        .limit(5);
      const rows = (outRes.data ?? []) as Array<{ content: unknown }>;
      let agg: Record<string, unknown> = {};
      for (const row of rows) {
        const c = asRecord(row.content);
        if (Object.keys(c).length) agg = { ...agg, ...c };
      }
      research = Object.keys(agg).length ? agg : null;
    }
  }

  const links = (linksRes.data ?? []) as Array<Record<string, unknown>>;

  return {
    organizationId,
    campaignId,
    campaign,
    funnel,
    funnelSteps,
    landingPages: ((landingRes.data ?? []) as Array<Record<string, unknown>>).map(decorateLandingForDisplay),
    bridgePages: (bridgeRes.data ?? []) as Array<Record<string, unknown>>,
    contentAssets: (contentRes.data ?? []) as Array<Record<string, unknown>>,
    adCreatives: (adsRes.data ?? []) as Array<Record<string, unknown>>,
    emailSequences: sequences,
    emailSequenceSteps,
    emailTemplates: (templatesRes.data ?? []) as Array<Record<string, unknown>>,
    leadCaptureForms: (formsRes.data ?? []) as Array<Record<string, unknown>>,
    affiliateLinks: links,
    research,
    latestPipelineRun: latestRun,
    approvals: (approvalsRes.data ?? []) as Array<Record<string, unknown>>,
    analyticsHints: {
      trackingLinks: links.map((l) => ({
        id: String(l.id),
        label: typeof l.label === "string" ? l.label : null,
        destination_url: String(l.destination_url ?? ""),
      })),
    },
  };
}

export type PipelineRunSnapshot = {
  status: string;
  current_stage: string | null;
  stages: Array<{ stage_key: string; status: string; output_summary?: string | null; error_message?: string | null }>;
  logs: Array<{ id: string; level: string; message: string; created_at: string; stage_id?: string | null }>;
};

export type ExecutionStepUi = {
  id: string;
  title: string;
  worker: string;
  creates: string;
  approval: string;
  status: "pending" | "running" | "complete" | "failed" | "approval_needed";
  stageKey: string;
};

const STEP_BLUEPRINT: Omit<ExecutionStepUi, "status">[] = [
  {
    id: "research_offer",
    title: "Research offer",
    worker: "offer_analyst, competitor_researcher",
    creates: "Offer summary, ICP, hooks, objections",
    approval: "No",
    stageKey: "research",
  },
  {
    id: "create_campaign",
    title: "Create campaign",
    worker: "campaign_planner",
    creates: "Campaign record + strategy metadata",
    approval: "Optional",
    stageKey: "strategy",
  },
  {
    id: "build_landing",
    title: "Build landing page",
    worker: "page_designer, copywriter",
    creates: "Landing page + bridge copy",
    approval: "Draft",
    stageKey: "creation",
  },
  {
    id: "build_funnel",
    title: "Build funnel",
    worker: "funnel_strategist",
    creates: "Funnel + ordered steps",
    approval: "Draft",
    stageKey: "creation",
  },
  {
    id: "generate_content",
    title: "Generate content",
    worker: "scriptwriter, creative_director",
    creates: "Hooks, scripts, captions",
    approval: "Draft",
    stageKey: "creation",
  },
  {
    id: "generate_ads",
    title: "Generate ads",
    worker: "ad_designer",
    creates: "Ad creatives by platform",
    approval: "Draft",
    stageKey: "creation",
  },
  {
    id: "email_sequence",
    title: "Build email sequence",
    worker: "email_writer",
    creates: "Templates + sequence steps",
    approval: "Before send",
    stageKey: "creation",
  },
  {
    id: "lead_capture",
    title: "Set lead capture",
    worker: "lead_capture_worker",
    creates: "Lead capture form + schema",
    approval: "Publish",
    stageKey: "execution",
  },
  {
    id: "analytics",
    title: "Setup analytics",
    worker: "tracking_worker",
    creates: "Tracking links + UTM defaults",
    approval: "No",
    stageKey: "execution",
  },
  {
    id: "approvals",
    title: "Create approvals",
    worker: "performance_marketer",
    creates: "Approval queue items",
    approval: "Yes",
    stageKey: "execution",
  },
];

const STAGE_ORDER = ["research", "strategy", "creation", "execution", "optimization"] as const;

function stageRank(key: string): number {
  const i = STAGE_ORDER.indexOf(key as (typeof STAGE_ORDER)[number]);
  return i >= 0 ? i : -1;
}

function stageStatusMap(snapshot: PipelineRunSnapshot | null): Record<string, string> {
  const m: Record<string, string> = {};
  if (!snapshot?.stages) return m;
  for (const s of snapshot.stages) {
    m[s.stage_key] = s.status;
  }
  return m;
}

export function buildExecutionSteps(
  snapshot: PipelineRunSnapshot | null,
  bundle: WorkspaceDisplayBundle | null,
): ExecutionStepUi[] {
  const sm = stageStatusMap(snapshot);
  const runStatus = snapshot?.status ?? "pending";
  const current = snapshot?.current_stage ?? null;

  const hasResearch = Boolean(bundle?.research && Object.keys(bundle.research).length);
  const hasCampaign = Boolean(bundle?.campaign);
  const hasLanding = (bundle?.landingPages?.length ?? 0) > 0;
  const hasFunnel = (bundle?.funnelSteps?.length ?? 0) > 0;
  const hasContent = (bundle?.contentAssets?.length ?? 0) > 0;
  const hasAds = (bundle?.adCreatives?.length ?? 0) > 0;
  const hasEmail = (bundle?.emailSequenceSteps?.length ?? 0) > 0 || (bundle?.emailSequences?.length ?? 0) > 0;
  const hasLeads = (bundle?.leadCaptureForms?.length ?? 0) > 0;
  const hasTracking = (bundle?.affiliateLinks?.length ?? 0) > 0;
  const pendingApprovals = (bundle?.approvals ?? []).filter((a) => String(a.status) === "pending").length;
  const hasApprovals = (bundle?.approvals?.length ?? 0) > 0;

  const dataSignals: Record<string, boolean> = {
    research_offer: hasResearch,
    create_campaign: hasCampaign,
    build_landing: hasLanding,
    build_funnel: hasFunnel,
    generate_content: hasContent,
    generate_ads: hasAds,
    email_sequence: hasEmail,
    lead_capture: hasLeads,
    analytics: hasTracking,
    approvals: hasApprovals,
  };

  return STEP_BLUEPRINT.map((def) => {
    const st = sm[def.stageKey] ?? "pending";
    let status: ExecutionStepUi["status"] = "pending";

    if (runStatus === "completed") {
      status = "complete";
    } else if (dataSignals[def.id]) {
      status = "complete";
    } else if (def.id === "approvals" && runStatus === "needs_approval" && pendingApprovals > 0) {
      status = "approval_needed";
    } else if (runStatus === "failed") {
      const curR = current ? stageRank(current) : 4;
      const myR = stageRank(def.stageKey);
      status = myR < curR ? "complete" : myR === curR ? "failed" : "pending";
    } else if (st === "failed") {
      status = current === def.stageKey ? "failed" : stageRank(def.stageKey) < stageRank(current ?? "optimization") ? "complete" : "pending";
    } else if (st === "running" && current === def.stageKey) {
      status = "running";
    } else if (st === "running" && current && stageRank(def.stageKey) < stageRank(current)) {
      status = "complete";
    } else if (st === "completed" && (def.stageKey === "research" || def.stageKey === "strategy")) {
      status = "complete";
    } else if (st === "completed" && stageRank(def.stageKey) < stageRank(current ?? "optimization")) {
      status = "complete";
    }

    return { ...def, status };
  });
}

export function buildRunTimeline(
  snapshot: PipelineRunSnapshot | null,
  bundle: WorkspaceDisplayBundle | null,
): { steps: ExecutionStepUi[]; stages: typeof STAGE_ORDER } {
  return { steps: buildExecutionSteps(snapshot, bundle), stages: [...STAGE_ORDER] };
}
