import type { LiveWorkspaceBuildInput } from "@/hooks/useLiveWorkspaceBuild";

const FUNNEL_STYLES = new Set([
  "clickfunnels_lead",
  "bridge_lead",
  "application",
  "webinar",
  "product_offer",
]);

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Map persisted `marketing_pipeline_runs.input` to a new live-build payload, or null if incomplete. */
export function pipelineRunInputToLiveBuild(input: unknown): LiveWorkspaceBuildInput | null {
  const r = asRecord(input);
  const url = typeof r.url === "string" ? r.url.trim() : "";
  const goal = typeof r.goal === "string" ? r.goal.trim() : "";
  const audience = typeof r.audience === "string" ? r.audience.trim() : "";
  const trafficSource = typeof r.trafficSource === "string" ? r.trafficSource.trim() : "";
  if (!url || !goal || !audience || !trafficSource) return null;

  const funnelRaw = typeof r.funnelStyle === "string" ? r.funnelStyle : "clickfunnels_lead";
  const funnelStyle = FUNNEL_STYLES.has(funnelRaw)
    ? (funnelRaw as LiveWorkspaceBuildInput["funnelStyle"])
    : "clickfunnels_lead";

  const provider =
    r.provider === "openclaw" || r.provider === "internal_llm" || r.provider === "hybrid" ? r.provider : "hybrid";
  const approvalMode = r.approvalMode === "required" || r.approvalMode === "auto_draft" ? r.approvalMode : "auto_draft";
  const mode = r.mode === "client" ? "client" : "affiliate";

  return {
    url,
    goal,
    audience,
    trafficSource,
    funnelStyle,
    provider,
    approvalMode,
    mode,
  };
}
