import type {
  LiveAd,
  LiveAnalytics,
  LiveApproval,
  LiveCampaign,
  LiveContentItem,
  LiveEmailStep,
  LiveFunnel,
  LiveFunnelStep,
  LiveLanding,
  LiveLeadCapture,
  LiveModuleOrigin,
  LiveResearch,
  LiveWorkspaceResults,
} from "@/services/workspace/liveWorkspaceTypes";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function originFrom(obj: unknown): LiveModuleOrigin {
  return str(asRecord(obj).source) === "live_preview" ? "live_preview" : "db";
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function normalizeLiveWorkspaceResults(rich: Record<string, unknown>): LiveWorkspaceResults {
  const runRec = asRecord(rich.run);
  const run = {
    runId: runRec.runId != null ? String(runRec.runId) : undefined,
    campaignId: runRec.campaignId != null ? String(runRec.campaignId) : runRec.campaign_id != null ? String(runRec.campaign_id) : null,
  };

  const researchRaw = rich.research;
  let research: LiveResearch | null = null;
  if (researchRaw && typeof researchRaw === "object") {
    const r = asRecord(researchRaw);
    const hooks = [...strArr(r.hooks), ...strArr(r.topHooks)].filter(Boolean).slice(0, 12);
    const offer = str(r.offerSummary) || str(r.offer_summary);
    if (offer || str(r.audience) || hooks.length) {
      research = {
        offerSummary: offer || "Research in progress…",
        audience: str(r.audience) || undefined,
        painPoints: strArr(r.painPoints).length ? strArr(r.painPoints) : strArr(r.pain_points),
        objections: strArr(r.buyerObjections).length ? strArr(r.buyerObjections) : strArr(r.buyer_objections),
        hooks: hooks.length ? hooks : strArr(r.topHooks),
        positioning: str(r.positioningAngle) || str(r.positioning_angle) || undefined,
        origin: originFrom(researchRaw),
      };
    }
  }

  let campaign: LiveCampaign | null = null;
  const cRaw = rich.campaign;
  if (cRaw && typeof cRaw === "object") {
    const c = asRecord(cRaw);
    const strategy = [str(c.description), str(c.offerAngle), str(c.ctaStrategy)].filter(Boolean).join(" · ").slice(0, 520);
    campaign = {
      id: c.id != null ? String(c.id) : null,
      name: str(c.name) || "Campaign",
      goal: str(c.goal) || "",
      audience: str(c.audience) || "",
      status: str(c.status) || "draft",
      strategy: strategy || str(c.goal) || "Strategy assembling…",
      origin: originFrom(cRaw),
    };
  }

  let landing: LiveLanding | null = null;
  const lRaw = rich.landing;
  if (lRaw && typeof lRaw === "object") {
    const L = asRecord(lRaw);
    const bullets = strArr(L.bullets);
    const headline = str(L.headline) || str(L.title);
    if (headline || str(L.cta) || bullets.length) {
      landing = {
        id: L.id != null ? String(L.id) : null,
        headline: headline || "Get More Qualified Leads with AI-Powered Marketing",
        subheadline: str(L.subheadline) || str(L.subtitle) || "",
        bullets,
        ctaText: str(L.cta) || str(L.primaryCta) || "Get started",
        previewUrl: str(L.previewUrl) || str(L.preview_url) || undefined,
        origin: originFrom(lRaw),
      };
    }
  }

  let funnel: LiveFunnel | null = null;
  const fRaw = rich.funnel;
  if (fRaw && typeof fRaw === "object") {
    const F = asRecord(fRaw);
    const rows = Array.isArray(F.steps) ? (F.steps as unknown[]) : [];
    const steps: LiveFunnelStep[] = rows.map((row) => {
      const s = asRecord(row);
      return {
        name: str(s.name) || str(s.title) || "Step",
        type: str(s.stepType) || str(s.step_type) || str(s.kind) || "step",
        status: str(s.status) || "draft",
      };
    });
    const flowDiagram = str(F.flowDiagram) || (Array.isArray(F.flow) ? (F.flow as string[]).join(" → ") : "");
    const flowLabels = flowDiagram
      ? flowDiagram.split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean)
      : [];
    const syntheticSteps: LiveFunnelStep[] =
      steps.length || !flowLabels.length
        ? steps
        : flowLabels.map((name, i) => ({ name, type: "flow", status: "live" }));
    if (syntheticSteps.length || flowDiagram) {
      funnel = {
        id: F.id != null ? String(F.id) : null,
        name: str(F.name) || "Funnel",
        steps: syntheticSteps,
        flowDiagram: flowDiagram || syntheticSteps.map((s) => s.name).join(" → "),
        origin: originFrom(fRaw),
      };
    }
  }

  const content: LiveContentItem[] = [];
  const coRaw = rich.content;
  if (coRaw && typeof coRaw === "object") {
    const C = asRecord(coRaw);
    const items = Array.isArray(C.items) ? (C.items as unknown[]) : [];
    for (const it of items.slice(0, 12)) {
      const o = asRecord(it);
      const hooks = strArr(o.hooks);
      content.push({
        id: str(o.id) || `c-${content.length}`,
        hook: hooks[0] || str(o.title) || "",
        script: str(o.scriptExcerpt) || str(o.script) || "",
        caption: strArr(o.captions)[0] || "",
        platform: str(o.platform) || "multi",
        cta: str(o.cta) || "",
      });
    }
    const prev = strArr(C.hooksPreview);
    for (let i = 0; i < prev.length && content.length < 12; i++) {
      content.push({
        id: `hook-${i}`,
        hook: prev[i]!,
        script: "",
        caption: "",
        platform: "multi",
        cta: "",
      });
    }
  }

  const ads: LiveAd[] = [];
  const aRaw = rich.ads;
  if (aRaw && typeof aRaw === "object") {
    const A = asRecord(aRaw);
    const items = Array.isArray(A.items) ? (A.items as unknown[]) : [];
    for (const it of items.slice(0, 8)) {
      const o = asRecord(it);
      ads.push({
        id: str(o.id) || `ad-${ads.length}`,
        platform: str(o.platform) || "paid",
        headline: str(o.headline) || "Creative",
        primaryText: str(o.primaryText) || str(o.primary_text) || "",
        cta: str(o.cta) || "Learn more",
        angle: str(o.angle) || "",
      });
    }
  }

  const emails: LiveEmailStep[] = [];
  const eRaw = rich.emails;
  if (eRaw && typeof eRaw === "object") {
    const E = asRecord(eRaw);
    const steps = Array.isArray(E.steps) ? (E.steps as unknown[]) : [];
    for (const st of steps.slice(0, 12)) {
      const s = asRecord(st);
      const delayMin = typeof s.delayMinutes === "number" ? s.delayMinutes : Number(s.delayMinutes ?? 0);
      emails.push({
        id: str(s.id) || `em-${emails.length}-${s.stepIndex}`,
        step: typeof s.stepIndex === "number" ? s.stepIndex : Number(s.stepIndex ?? emails.length),
        subject: str(s.subject) || "Email",
        preview: str(s.bodyPreview) || str(s.body_preview) || "",
        delay: delayMin <= 0 ? "Immediate" : delayMin < 1440 ? `${delayMin} min` : `${Math.round(delayMin / 1440)}d`,
      });
    }
  }

  let leadCapture: LiveLeadCapture | null = null;
  const lcRaw = rich.leadCapture;
  if (lcRaw && typeof lcRaw === "object") {
    const Lc = asRecord(lcRaw);
    const forms = Array.isArray(Lc.forms) ? (Lc.forms as unknown[]) : [];
    const f0 = forms[0] ? asRecord(forms[0]) : {};
    const fields = strArr(f0.fields);
    const fieldLabels = Array.isArray(f0.fields) ? (f0.fields as unknown[]).map((x) => (typeof x === "string" ? x : str(asRecord(x).label))) : fields;
    if (forms.length) {
      leadCapture = {
        id: str(f0.id) || null,
        formName: str(f0.name) || "Lead form",
        fields: fieldLabels.filter(Boolean),
        cta: str(f0.cta) || "Submit",
        publicUrl: str(f0.captureUrl) || str(f0.publicUrl) || undefined,
        origin: originFrom(lcRaw),
      };
    }
  }

  let analytics: LiveAnalytics | null = null;
  const anRaw = rich.analytics;
  if (anRaw && typeof anRaw === "object") {
    const An = asRecord(anRaw);
    const links = Array.isArray(An.links) ? (An.links as unknown[]) : [];
    const first = links[0] ? asRecord(links[0]) : {};
    const tracking = str(first.destination_url) || str(An.trackingLink);
    analytics = {
      trackingLink: tracking || undefined,
      events: An.eventsInitialized ? ["page_view", "cta_click", "lead_submit"] : ["page_view"],
      status: str(An.status) || (An.trackingReady ? "ready" : "pending"),
      origin: originFrom(anRaw),
    };
  }

  const approvals: LiveApproval[] = [];
  const apRaw = rich.approvals;
  if (apRaw && typeof apRaw === "object") {
    const Ap = asRecord(apRaw);
    const items = Array.isArray(Ap.items) ? (Ap.items as unknown[]) : [];
    for (const it of items.slice(0, 24)) {
      const o = asRecord(it);
      approvals.push({
        id: str(o.id),
        type: str(o.approval_type) || str(o.type) || "approval",
        status: str(o.status) || "pending",
        target: str(o.target_entity_type) || str(o.action) || "",
        risk: str(o.risk) || str(o.payloadSummary) || "",
      });
    }
  }

  return {
    run,
    research,
    campaign,
    landing,
    funnel,
    content,
    ads,
    emails,
    leadCapture,
    analytics,
    approvals,
  };
}
