import type { WorkspaceDisplayBundle } from "@/services/workspace/workspaceDisplayBundle";
import {
  buildAdsStreamPayload,
  buildAnalyticsStreamPayload,
  buildCampaignStreamPayload,
  buildContentStreamPayload,
  buildEmailsStreamPayload,
  buildFunnelStreamPayload,
  buildLandingStreamPayload,
  buildLeadCaptureStreamPayload,
  buildResearchStreamPayload,
} from "@/services/ai/workspaceStreamPayloads";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function num(v: unknown, fb = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}

/** Merge pipeline research with campaign metadata + row fields so UI never stays empty. */
function mergedResearchRecord(bundle: WorkspaceDisplayBundle | null): Record<string, unknown> | null {
  if (!bundle?.campaign && !bundle?.research) return null;
  const base: Record<string, unknown> = { ...(bundle.research ?? {}) };
  const c = bundle.campaign;
  if (c) {
    const meta = asRecord(c.metadata);
    const ch = asRecord(meta.content_hooks_scripts ?? meta.contentHooksScripts);
    const metaHooks = strArr(ch.hooks);
    const existing = [...strArr(base.hooks), ...strArr(base.hook_starters)];
    if (metaHooks.length && !existing.length) {
      base.hooks = metaHooks;
      base.hook_starters = metaHooks;
    }
    const aud = str(c.target_audience);
    if (aud && !str(base.audience_summary) && !str(base.audience) && !str(base.icp)) {
      base.audience_summary = aud;
    }
    const desc = str(c.description);
    if (desc && !str(base.offer_summary) && !str(base.offerSummary)) {
      base.offer_summary = desc.slice(0, 360);
    }
    const obj = strArr(meta.buyer_objections ?? meta.objections);
    if (obj.length) base.buyer_objections = obj;
    const pos = str(meta.positioning_angle ?? meta.positioningAngle ?? meta.offer_angle);
    if (pos) base.positioning_angle = pos;
  }
  return Object.keys(base).length ? base : null;
}

function bulletsFromBlocks(blocks: unknown): string[] {
  const arr = Array.isArray(blocks) ? blocks : [];
  const out: string[] = [];
  for (const b of arr) {
    const o = asRecord(b);
    const items = o.items;
    if (Array.isArray(items)) {
      for (const it of items) {
        if (typeof it === "string" && it.trim()) out.push(it.trim());
        else if (it && typeof it === "object") {
          const t = str((it as Record<string, unknown>).text ?? (it as Record<string, unknown>).label);
          if (t) out.push(t);
        }
      }
    }
    const bullets = o.bullets;
    if (Array.isArray(bullets)) {
      for (const x of bullets) {
        if (typeof x === "string" && x.trim()) out.push(x.trim());
      }
    }
  }
  return out.slice(0, 10);
}

function leadMagnetFromBlocks(blocks: unknown): string | undefined {
  const arr = Array.isArray(blocks) ? blocks : [];
  for (const b of arr) {
    const o = asRecord(b);
    if (str(o.type) === "lead_magnet" || str(o.role) === "lead_magnet") {
      return str(o.title) || str(o.headline) || undefined;
    }
  }
  return undefined;
}

export function buildLandingRichPayload(bundle: WorkspaceDisplayBundle | null) {
  const lp = bundle?.landingPages?.[0] as Record<string, unknown> | undefined;
  if (lp) {
    const base = buildLandingStreamPayload(lp);
    if (!base) return null;
    const bullets = bulletsFromBlocks(lp.blocks);
    return {
      ...base,
      bullets,
      leadMagnetTitle: leadMagnetFromBlocks(lp.blocks),
      primaryCta: base.cta,
      updatedAt: str(lp.updated_at) || str(lp.created_at),
    };
  }
  const c = bundle?.campaign;
  if (!c) return null;
  const meta = asRecord(c.metadata);
  const ls = asRecord(meta.landing_settings);
  const headline = str(ls.meta_title) || (str(c.name) ? `${str(c.name)} — ${str(c.description).slice(0, 72)}` : "");
  const sub = str(ls.meta_description) || str(c.description).slice(0, 200);
  const cta = str(ls.cta_button_text);
  if (!headline && !cta && !str(ls.landing_url)) return null;
  return {
    id: null as string | null,
    headline: headline || str(c.name) || "Landing",
    subheadline: sub,
    cta: cta || "Get started",
    title: headline || str(c.name),
    bullets: [] as string[],
    leadMagnetTitle: str(meta.lead_magnet_title) || undefined,
    primaryCta: cta || "Get started",
    previewUrl: str(ls.landing_url) || undefined,
    source: "metadata" as const,
    updatedAt: str(c.updated_at),
  };
}

export function buildResearchRichPayload(bundle: WorkspaceDisplayBundle | null) {
  const merged = mergedResearchRecord(bundle);
  const base = buildResearchStreamPayload(merged);
  if (!base) return null;
  return {
    ...base,
    topHooks: Array.isArray(base.hooks) ? base.hooks.slice(0, 8) : [],
    updatedAt: bundle?.campaign ? str((bundle.campaign as Record<string, unknown>).updated_at) : undefined,
  };
}

export function buildCampaignRichPayload(
  bundle: WorkspaceDisplayBundle | null,
  run: unknown,
  runInput: Record<string, unknown> | null,
) {
  const base = buildCampaignStreamPayload(bundle, run, runInput);
  if (!base) return null;
  const c = bundle?.campaign;
  const meta = c ? asRecord(c.metadata) : {};
  return {
    ...base,
    status: c ? str(c.status) || "draft" : "draft",
    offerAngle: str(meta.offer_angle ?? meta.positioning_angle),
    ctaStrategy: str(meta.cta_strategy ?? meta.ctaStrategy),
    description: c ? str(c.description) : "",
    updatedAt: c ? str(c.updated_at) : undefined,
  };
}

function hooksFromAsset(a: Record<string, unknown>): string[] {
  const out: string[] = [];
  const ang = a.angles;
  if (Array.isArray(ang)) {
    for (const x of ang) {
      if (typeof x === "string" && x.trim()) out.push(x.trim());
      else if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        const t = str(o.text) || str(o.angle) || str(o.hook);
        if (t.trim()) out.push(t.trim());
      }
    }
  }
  return out.slice(0, 8);
}

export function buildContentRichPayload(bundle: WorkspaceDisplayBundle | null) {
  const assets = bundle?.contentAssets ?? [];
  const fromDb = buildContentStreamPayload(assets);
  const items =
    assets.slice(0, 8).map((a) => {
      const ar = asRecord(a);
      const caps = Array.isArray(ar.captions) ? ar.captions.filter((x): x is string => typeof x === "string") : [];
      const md = typeof ar.script_markdown === "string" ? ar.script_markdown.trim() : "";
      return {
        id: str(ar.id),
        title: str(ar.title) || "Content asset",
        platform: str(ar.platform) || "multi",
        status: str(ar.status) || "draft",
        hooks: hooksFromAsset(ar),
        scriptExcerpt: md.slice(0, 220),
        captions: caps.slice(0, 4),
        cta: str(asRecord(ar.metadata).cta),
        updatedAt: str(ar.updated_at),
      };
    }) ?? [];

  if (items.length) {
    return {
      ...(fromDb ?? { totalCount: items.length, hooksCount: 0, hooksPreview: [], scriptsPreview: [] }),
      items,
    };
  }

  const c = bundle?.campaign;
  if (!c) return fromDb;
  const meta = asRecord(c.metadata);
  const ch = asRecord(meta.content_hooks_scripts ?? meta.contentHooksScripts);
  const hooks = strArr(ch.hooks).slice(0, 8);
  const scripts = strArr(ch.scripts);
  if (!hooks.length && !scripts.length) return fromDb;
  const pseudoItems = hooks.slice(0, 5).map((h, i) => ({
    id: `meta-hook-${i}`,
    title: `Hook ${i + 1}`,
    platform: "metadata",
    status: "draft",
    hooks: [h],
    scriptExcerpt: scripts[i] ?? "",
    captions: [] as string[],
    cta: "",
    updatedAt: str(c.updated_at),
  }));
  return {
    totalCount: pseudoItems.length,
    hooksCount: hooks.length,
    hooksPreview: hooks.slice(0, 10),
    scriptsPreview: scripts.slice(0, 2).map((s) => s.slice(0, 320)),
    firstTitle: str(c.name),
    items: pseudoItems,
    source: "metadata" as const,
  };
}

function adRowsFromCampaignMetadata(campaign: Record<string, unknown> | null): Array<Record<string, unknown>> {
  if (!campaign) return [];
  const meta = asRecord(campaign.metadata);
  const adsMeta = asRecord(meta.ads);
  const rows = Array.isArray(adsMeta.ad_templates)
    ? (adsMeta.ad_templates as unknown[])
    : Array.isArray(meta.ad_templates)
      ? (meta.ad_templates as unknown[])
      : [];
  return rows.filter((x) => x && typeof x === "object").map((x) => x as Record<string, unknown>);
}

export function buildAdsRichPayload(bundle: WorkspaceDisplayBundle | null) {
  const direct = buildAdsStreamPayload(bundle?.adCreatives);
  if (direct && direct.count > 0) {
    return {
      ...direct,
      items: (direct.items as Array<Record<string, unknown>>).map((ad) => {
        const ar = asRecord(ad);
        return {
          ...ar,
          cta: str(ar.cta),
          angle: str(ar.angle),
        };
      }),
    };
  }
  const fromMeta = adRowsFromCampaignMetadata(bundle?.campaign ?? null).slice(0, 6).map((r, i) => ({
    id: `meta-ad-${i}`,
    headline: str(r.ad_name) || str(r.headline) || `Ad concept ${i + 1}`,
    primaryText: str(r.hooks).slice(0, 220),
    platform: str(r.platform) || "paid",
    cta: str(r.cta),
    angle: str(r.target_audience),
  }));
  if (fromMeta.length) return { count: fromMeta.length, items: fromMeta, source: "metadata" as const };

  const assets = bundle?.contentAssets ?? [];
  const pseudo: Array<Record<string, unknown>> = [];
  for (const a of assets) {
    const ar = asRecord(a);
    const meta = asRecord(ar.metadata);
    const kind = str(meta.type ?? meta.kind).toLowerCase();
    const title = str(ar.title).toLowerCase();
    if (kind.includes("ad") || title.includes("ad") || kind.includes("creative")) {
      pseudo.push({
        id: str(ar.id),
        headline: str(ar.title) || "Creative",
        primaryText: (typeof ar.script_markdown === "string" ? ar.script_markdown : "").slice(0, 220),
        platform: str(ar.platform) || "content",
        cta: str(meta.cta),
        angle: hooksFromAsset(ar)[0] ?? "",
      });
    }
    if (pseudo.length >= 5) break;
  }
  if (!pseudo.length) return null;
  return { count: pseudo.length, items: pseudo, source: "content_assets" as const };
}

export function buildEmailsRichPayload(bundle: WorkspaceDisplayBundle | null) {
  const base = buildEmailsStreamPayload(bundle);
  const steps = bundle?.emailSequenceSteps ?? [];
  const templates = bundle?.emailTemplates ?? [];
  const tById = new Map<string, Record<string, unknown>>();
  for (const t of templates) {
    if (typeof t.id === "string") tById.set(t.id, t as Record<string, unknown>);
  }
  if (steps.length) {
    const mapped = [...steps]
      .sort((a, b) => num(a.step_index) - num(b.step_index))
      .slice(0, 12)
      .map((s, i) => {
        const tid = typeof s.template_id === "string" ? s.template_id : "";
        const tmpl = tid ? tById.get(tid) : undefined;
        const body = tmpl && typeof tmpl.body_markdown === "string" ? tmpl.body_markdown : "";
        return {
          stepIndex: num(s.step_index, i),
          delayMinutes: num(s.delay_minutes, 0),
          subject: tmpl ? str(tmpl.subject) : `Step ${i + 1}`,
          templateName: tmpl ? str(tmpl.name) : "",
          bodyPreview: body.replace(/\s+/g, " ").trim().slice(0, 260),
          updatedAt: str(s.updated_at),
        };
      });
    return { ...(base ?? { sequenceName: "Email sequence" }), steps: mapped };
  }
  const c = bundle?.campaign;
  if (!c) return base;
  const meta = asRecord(c.metadata);
  const emailsMeta = asRecord(meta.emails);
  const rows = Array.isArray(emailsMeta.email_sequence)
    ? (emailsMeta.email_sequence as unknown[])
    : Array.isArray(meta.email_sequence)
      ? (meta.email_sequence as unknown[])
      : [];
  const mapped = rows.slice(0, 8).map((row, i) => {
    const e = asRecord(row);
    return {
      stepIndex: i + 1,
      delayMinutes: num(e.day, i + 1) * 1440,
      subject: str(e.subject) || `Email ${i + 1}`,
      templateName: str(e.template),
      bodyPreview: "",
      updatedAt: str(c.updated_at),
    };
  });
  if (!mapped.length) return base;
  return { sequenceName: str(asRecord(meta.emails).sequence_name) || "Email sequence (metadata)", steps: mapped, source: "metadata" as const };
}

function fieldLabelsFromSchema(schema: unknown): string[] {
  const s = asRecord(schema);
  const fields = s.fields;
  if (Array.isArray(fields)) {
    return fields
      .map((f) => {
        const fr = asRecord(f);
        return str(fr.name) || str(fr.id) || str(fr.key);
      })
      .filter(Boolean)
      .slice(0, 12);
  }
  const props = asRecord(s.properties);
  if (props && typeof props === "object") return Object.keys(props).slice(0, 12);
  return [];
}

export function buildLeadCaptureRichPayload(bundle: WorkspaceDisplayBundle | null, campaignId: string | null) {
  const base = buildLeadCaptureStreamPayload(bundle?.leadCaptureForms);
  const forms = bundle?.leadCaptureForms ?? [];
  if (!forms.length) {
    const c = bundle?.campaign;
    if (!c || !campaignId) return base;
    const meta = asRecord(c.metadata);
    const lc = asRecord(meta.lead_capture_settings);
    let ff = strArr(lc.form_fields);
    if (!ff.length && typeof lc.form_fields === "string") {
      ff = String(lc.form_fields)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (!ff.length && !str(lc.incentive)) return base;
    return {
      forms: [
        {
          id: "metadata-form",
          name: "Lead capture (from campaign metadata)",
          status: "draft",
          fields: ff.length ? ff : ["email", "full_name"],
          incentive: str(lc.incentive),
          cta: str(lc.cta),
          captureUrl: `/api/leads/capture?campaignId=${campaignId}`,
          source: "metadata",
        },
      ],
    };
  }
  const enriched = forms.map((f) => {
    const fr = asRecord(f);
    const schema = fr.schema;
    return {
      id: str(fr.id),
      name: str(fr.name) || "Lead form",
      status: str(fr.status) || "draft",
      fields: fieldLabelsFromSchema(schema),
      incentive: str(asRecord(fr.metadata).incentive),
      cta: str(asRecord(fr.metadata).cta),
      captureUrl: campaignId ? `/api/leads/capture?campaignId=${campaignId}` : undefined,
      funnelId: str(fr.funnel_id),
      updatedAt: str(fr.updated_at),
    };
  });
  return { forms: enriched };
}

export function buildApprovalsRichPayload(bundle: WorkspaceDisplayBundle | null) {
  const rows = bundle?.approvals ?? [];
  if (!rows.length) return null;
  const items = rows.slice(0, 30).map((a) => {
    const ar = asRecord(a);
    const payload = ar.payload;
    let summary = "";
    if (payload && typeof payload === "object") {
      try {
        summary = JSON.stringify(payload).slice(0, 180);
      } catch {
        summary = "";
      }
    }
    return {
      id: str(ar.id),
      approval_type: str(ar.approval_type),
      status: str(ar.status),
      action: str(ar.action) || str(ar.approval_type),
      created_at: str(ar.created_at),
      target_entity_type: str(ar.target_entity_type),
      target_entity_id: str(ar.target_entity_id),
      payloadSummary: summary,
      risk: str(asRecord(ar.metadata).risk ?? ar.error_message),
    };
  });
  const pending = items.filter((x) => x.status === "pending").length;
  return { items, pendingCount: pending };
}

export function buildAnalyticsRichPayload(bundle: WorkspaceDisplayBundle | null, executionActive: boolean) {
  const base = buildAnalyticsStreamPayload(bundle, { executionActive });
  return {
    ...base,
    postbackRoute: "/api/track/postback",
    affiliateClickRoute: "/api/affiliate/click/[affiliateLinkId]",
    campaignId: bundle?.campaignId,
  };
}

export function buildFunnelRichPayload(bundle: WorkspaceDisplayBundle | null) {
  const base = buildFunnelStreamPayload(bundle);
  const steps = (base?.steps as Array<Record<string, unknown>>) ?? [];
  const enriched = steps.map((s) => {
    const meta = asRecord(s.metadata);
    return {
      ...s,
      status: str(meta.status) || str(meta.publish_status) || "live",
    };
  });
  return { ...base, steps: enriched };
}

/**
 * Full normalized workspace snapshot for SSE + campaign UI.
 * Merges DB tables with campaign.metadata (OpenClaw legacy shapes).
 */
export function buildRichWorkspaceResults(
  bundle: WorkspaceDisplayBundle | null,
  run: unknown,
  runInput: Record<string, unknown> | null,
  executionActive = false,
): Record<string, unknown> {
  if (!bundle) return {};
  const out: Record<string, unknown> = {};
  const research = buildResearchRichPayload(bundle);
  if (research) out.research = research;

  const campaign = buildCampaignRichPayload(bundle, run, runInput);
  if (campaign) out.campaign = campaign;

  const landing = buildLandingRichPayload(bundle);
  if (landing) out.landing = landing;

  out.funnel = buildFunnelRichPayload(bundle);

  const content = buildContentRichPayload(bundle);
  if (content) out.content = content;

  const ads = buildAdsRichPayload(bundle);
  if (ads) out.ads = ads;

  const emails = buildEmailsRichPayload(bundle);
  if (emails) out.emails = emails;

  const lead = buildLeadCaptureRichPayload(bundle, bundle.campaignId);
  if (lead) out.leadCapture = lead;

  out.analytics = buildAnalyticsRichPayload(
    bundle,
    Boolean(bundle.analyticsHints?.trackingLinks?.length) || executionActive,
  );

  const appr = buildApprovalsRichPayload(bundle);
  if (appr) out.approvals = appr;

  const runRec = asRecord(run);
  const rid = bundle.latestPipelineRun?.id ?? (runRec.id ? str(runRec.id) : "");
  const cid = bundle.campaignId ?? (runRec.campaign_id != null ? String(runRec.campaign_id) : null);
  if (rid || cid) {
    out.run = { runId: rid || undefined, campaignId: cid };
  }
  return out;
}

/** Convenience for pages that only have the bundle (no live run row). */
function runInputFromCampaign(c: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!c) return null;
  const meta = asRecord(c.metadata);
  const g = str(meta.goal);
  const a = str(c.target_audience);
  const t = str(meta.trafficSource ?? meta.traffic);
  if (!g.trim() && !a.trim() && !t.trim()) return null;
  return { goal: g, audience: a, trafficSource: t };
}

export function bundleToRichWorkspaceResults(bundle: WorkspaceDisplayBundle | null): Record<string, unknown> {
  if (!bundle) return {};
  const syntheticRun = bundle.latestPipelineRun
    ? { id: bundle.latestPipelineRun.id, campaign_id: bundle.campaignId, status: bundle.latestPipelineRun.status }
    : null;
  const ri = bundle.campaign ? runInputFromCampaign(bundle.campaign as Record<string, unknown>) : null;
  return buildRichWorkspaceResults(bundle, syntheticRun, ri, false);
}

/** Alias for campaign/workspace UIs that imported the old name. */
export const bundleToAiWorkspaceResults = bundleToRichWorkspaceResults;
