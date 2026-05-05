import type { WorkspaceDisplayBundle } from "@/services/workspace/workspaceDisplayBundle";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Parse marketing_pipeline_runs.input json */
export function parseRunInput(run: unknown): Record<string, unknown> | null {
  const r = asRecord(run);
  const raw = r.input;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return asRecord(raw);
}

export function buildResearchStreamPayload(research: Record<string, unknown> | null | undefined) {
  if (!research || !Object.keys(research).length) return null;
  const hooks = strArr(research.hook_starters).length
    ? strArr(research.hook_starters)
    : strArr(research.hooks);
  const pain = strArr(research.pain_points).length ? strArr(research.pain_points) : strArr(research.painPoints);
  const audience =
    str(research.audience_summary) ||
    str(research.audience) ||
    str(research.icp_summary) ||
    str(research.icp);
  const objections =
    strArr(research.buyer_objections).length > 0
      ? strArr(research.buyer_objections)
      : strArr(research.objections);
  return {
    audience: audience || undefined,
    painPoints: pain,
    hooks,
    offerSummary: str(research.offer_summary) || str(research.offerSummary) || undefined,
    buyerObjections: objections,
    positioningAngle: str(research.positioning_angle) || str(research.positioningAngle) || undefined,
    offerAngle: str(research.offer_angle) || str(research.offerAngle) || undefined,
    raw: research,
  };
}

export function buildCampaignStreamPayload(
  bundle: WorkspaceDisplayBundle | null,
  run: unknown,
  runInput: Record<string, unknown> | null,
): { id: string | null; name: string; goal: string; audience: string; trafficSource?: string } | null {
  const c = bundle?.campaign;
  const runRec = asRecord(run);
  const cidFromRun =
    typeof runRec.campaign_id === "string"
      ? runRec.campaign_id
      : runRec.campaign_id != null
        ? String(runRec.campaign_id)
        : null;
  const id = bundle?.campaignId ?? cidFromRun ?? (c && typeof c.id === "string" ? String(c.id) : null);
  const meta = c ? asRecord(c.metadata) : {};
  const goal =
    str(runInput?.goal) ||
    str(meta.goal) ||
    str(c?.["objective"]) ||
    str(c?.["description"]) ||
    "";
  const audience =
    str(runInput?.audience) ||
    str(c?.["target_audience"]) ||
    str(meta.audience) ||
    "";
  const trafficSource = str(runInput?.trafficSource) || str(runInput?.traffic) || str(meta.trafficSource) || undefined;
  if (!id && !c) {
    if (!runInput || (!goal.trim() && !audience.trim())) return null;
    return {
      id: null,
      name: "Campaign",
      goal: goal || "Defining positioning from your goal…",
      audience: audience || "Audience from your brief",
      trafficSource,
    };
  }
  const name = (c && str(c.name)) || "Campaign";
  return { id: id ?? (c && typeof c.id === "string" ? String(c.id) : null), name, goal, audience, trafficSource };
}

function firstCtaFromBlocks(blocks: unknown): string {
  const arr = Array.isArray(blocks) ? blocks : [];
  for (const b of arr) {
    const o = asRecord(b);
    const label = str(o.cta_label) || str(o.button_text) || str(o.label);
    if (label) return label;
  }
  return "";
}

export function buildLandingStreamPayload(lp: Record<string, unknown> | null | undefined) {
  if (!lp) return null;
  const headline = str(lp.display_headline) || str(lp.title) || "";
  const sub = str(lp.display_subheadline) || str(lp.description) || "";
  const cta = str(lp.primary_cta_label) || firstCtaFromBlocks(lp.blocks);
  return {
    id: str(lp.id) || null,
    headline,
    subheadline: sub,
    cta: cta || "Get started",
    title: str(lp.title) || headline,
  };
}

const DEFAULT_FUNNEL_FLOW = ["Landing", "Bridge", "Capture", "CTA", "Thank You"] as const;

const FUNNEL_LABEL: Record<string, string> = {
  landing: "Landing",
  form: "Capture",
  lead: "Capture",
  squeeze: "Capture",
  bridge: "Bridge",
  cta: "CTA",
  thank_you: "Thank You",
  email_trigger: "Nurture",
};

export function buildFunnelStreamPayload(bundle: WorkspaceDisplayBundle | null) {
  const funnel = bundle?.funnel;
  const rows = bundle ? [...(bundle.funnelSteps ?? [])].sort((a, b) => Number(a.step_index ?? 0) - Number(b.step_index ?? 0)) : [];
  const flowFromRows = rows.map((s) => {
    const t = String(s.step_type ?? "");
    return FUNNEL_LABEL[t] || (t ? t.replace(/_/g, " ") : "Step");
  });
  const flow = flowFromRows.length ? flowFromRows : [...DEFAULT_FUNNEL_FLOW];
  const steps = rows.map((s) => ({
    id: str(s.id),
    name: str(s.name) || FUNNEL_LABEL[String(s.step_type)] || "Step",
    stepType: str(s.step_type),
    slug: str(s.slug),
    index: Number(s.step_index ?? 0),
  }));
  return {
    id: funnel && typeof funnel.id === "string" ? funnel.id : null,
    name: funnel && str(funnel.name) ? str(funnel.name) : "Funnel",
    flow,
    flowDiagram: flow.join(" → "),
    steps,
  };
}

export function buildContentStreamPayload(assets: Array<Record<string, unknown>> | undefined) {
  if (!assets?.length) return null;
  const hooks: string[] = [];
  for (const a of assets) {
    const ang = a.angles;
    if (Array.isArray(ang)) {
      for (const x of ang) {
        if (typeof x === "string" && x.trim()) hooks.push(x.trim());
        else if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          const t = str(o.text) || str(o.angle) || str(o.hook);
          if (t.trim()) hooks.push(t.trim());
        }
      }
    }
    const cap = a.captions;
    if (Array.isArray(cap)) {
      for (const x of cap) {
        if (typeof x === "string" && x.trim()) hooks.push(x.trim());
      }
    }
    if (hooks.length >= 12) break;
  }
  const scriptsPreview: string[] = [];
  for (const a of assets) {
    const md = typeof a.script_markdown === "string" ? a.script_markdown.trim() : "";
    if (md) scriptsPreview.push(md.slice(0, 320));
    if (scriptsPreview.length >= 2) break;
  }
  return {
    totalCount: assets.length,
    hooksPreview: hooks.slice(0, 10),
    hooksCount: hooks.length,
    firstTitle: str(assets[0]?.title) || undefined,
    scriptsPreview,
  };
}

export function buildAdsStreamPayload(ads: Array<Record<string, unknown>> | undefined) {
  if (!ads?.length) return null;
  return {
    count: ads.length,
    items: ads.slice(0, 5).map((ad) => ({
      id: str(ad.id),
      headline: str(ad.headline),
      primaryText: str(ad.primary_text).slice(0, 200),
      platform: str(ad.platform),
    })),
  };
}

export function buildEmailsStreamPayload(bundle: WorkspaceDisplayBundle | null) {
  const steps = bundle?.emailSequenceSteps ?? [];
  const templates = bundle?.emailTemplates ?? [];
  if (!steps.length) return null;
  const tById = new Map<string, Record<string, unknown>>();
  for (const t of templates) {
    if (typeof t.id === "string") tById.set(t.id, t);
  }
  const sequence = bundle?.emailSequences?.[0];
  const sequenceName = sequence && str(sequence.name) ? str(sequence.name) : "Email sequence";
  const mapped = [...steps]
    .sort((a, b) => Number(a.step_index ?? 0) - Number(b.step_index ?? 0))
    .map((s, i) => {
      const tid = typeof s.template_id === "string" ? s.template_id : "";
      const tmpl = tid ? tById.get(tid) : undefined;
      return {
        stepIndex: Number(s.step_index ?? i),
        delayMinutes: Number(s.delay_minutes ?? 0),
        subject: tmpl ? str(tmpl.subject) : `Step ${i + 1}`,
        templateName: tmpl ? str(tmpl.name) : "",
      };
    });
  return { sequenceName, steps: mapped };
}

export function buildLeadCaptureStreamPayload(forms: Array<Record<string, unknown>> | undefined) {
  if (!forms?.length) return null;
  return {
    forms: forms.map((f) => ({ id: str(f.id), name: str(f.name) || "Lead form", status: str(f.status) || "draft" })),
  };
}

export function buildAnalyticsStreamPayload(
  bundle: WorkspaceDisplayBundle | null,
  opts: { executionActive: boolean },
) {
  const links = bundle?.analyticsHints?.trackingLinks ?? [];
  const ready = links.length > 0;
  return {
    trackingReady: ready,
    eventsInitialized: ready || opts.executionActive,
    links: links.map((l) => ({ id: l.id, label: l.label, destination_url: l.destination_url })),
    status: ready ? "ready" : opts.executionActive ? "initializing" : "pending",
  };
}

export function buildApprovalsStreamPayload(rows: Array<Record<string, unknown>> | undefined) {
  if (!rows?.length) return null;
  const items = rows.map((a) => ({
    id: str(a.id),
    approval_type: str(a.approval_type),
    status: str(a.status),
    action: str(a.action) || str(a.approval_type),
    created_at: str(a.created_at),
  }));
  const pending = items.filter((x) => x.status === "pending").length;
  return { items, pendingCount: pending };
}
