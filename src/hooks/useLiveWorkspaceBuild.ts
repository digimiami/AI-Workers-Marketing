"use client";

import * as React from "react";

import type {
  LiveAd,
  LiveAnalytics,
  LiveApproval,
  LiveBuildStepKey,
  LiveBuildStepStatus,
  LiveCampaign,
  LiveContentItem,
  LiveEmailStep,
  LiveFunnel,
  LiveLanding,
  LiveLeadCapture,
  LiveResearch,
} from "@/services/workspace/liveWorkspaceTypes";
import { LIVE_BUILD_STEP_LABELS, LIVE_WORKSPACE_TIMELINE_KEYS, liveWorkspaceProgress } from "@/services/workspace/liveWorkspaceTypes";

export type LiveWorkspaceBuildInput = {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  provider?: "openclaw" | "internal_llm" | "hybrid";
  approvalMode?: "required" | "auto_draft";
  mode?: "affiliate" | "client";
};

export type LiveWorkspaceBuildState = {
  active: boolean;
  steps: Array<{ key: LiveBuildStepKey; label: string; status: LiveBuildStepStatus; message?: string }>;
  results: Partial<{
    run: { runId?: string; campaignId?: string | null };
    research: LiveResearch;
    campaign: LiveCampaign;
    landing: LiveLanding;
    funnel: LiveFunnel;
    content: LiveContentItem[];
    ads: LiveAd[];
    emails: LiveEmailStep[];
    lead_capture: LiveLeadCapture;
    analytics: LiveAnalytics;
    approvals: LiveApproval[];
    logs: { lines: Array<{ id: string; level: string; message: string; at: string }> };
  }>;
  modulePulseAt: Partial<Record<string, number>>;
  runId: string | null;
  campaignId: string | null;
  reviewUrl: string | null;
  finalStatus: string | null;
  errors: Array<{ key?: string; message: string }>;
};

function initialSteps() {
  return LIVE_WORKSPACE_TIMELINE_KEYS.map((key) => ({
    key,
    label: LIVE_BUILD_STEP_LABELS[key],
    status: "pending" as LiveBuildStepStatus,
  }));
}

function initialResults(): LiveWorkspaceBuildState["results"] {
  return {};
}

function parseSseBlock(block: string): { event: string; data: string } {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  return { event, data: dataLines.join("\n") };
}

export function useLiveWorkspaceBuild() {
  const abortRef = React.useRef<AbortController | null>(null);
  const runIdRef = React.useRef<string | null>(null);
  const campaignIdRef = React.useRef<string | null>(null);

  const [state, setState] = React.useState<LiveWorkspaceBuildState>(() => ({
    active: false,
    steps: initialSteps(),
    results: initialResults(),
    modulePulseAt: {},
    runId: null,
    campaignId: null,
    reviewUrl: null,
    finalStatus: null,
    errors: [],
  }));

  React.useEffect(() => {
    runIdRef.current = state.runId;
    campaignIdRef.current = state.campaignId;
  }, [state.runId, state.campaignId]);

  const updateStep = React.useCallback((key: string, status: LiveBuildStepStatus, message?: string) => {
    const k = key as LiveBuildStepKey;
    if (!LIVE_WORKSPACE_TIMELINE_KEYS.includes(k)) return;
    setState((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.key === k ? { ...s, status, message } : s)),
    }));
  }, []);

  // UI-only hinting for external modules (e.g. Ads Engine simulate launch).
  const hintStep = React.useCallback((key: LiveBuildStepKey, message: string) => {
    setState((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.key === key ? { ...s, message } : s)),
    }));
  }, []);

  const ingestEvent = React.useCallback(
    (event: string, raw: string) => {
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      if (event === "step") {
        const d = payload as { key?: string; status?: LiveBuildStepStatus; message?: string };
        if (d.key && d.status) updateStep(d.key, d.status, d.message);
        return;
      }
      if (event === "result") {
        const d = payload as { key?: string; data?: unknown };
        if (!d.key) return;
        if (d.key === "run") {
          const r = (d.data ?? {}) as { runId?: string; campaignId?: string | null };
          setState((prev) => ({
            ...prev,
            runId: r.runId != null ? String(r.runId) : prev.runId,
            campaignId: r.campaignId != null ? String(r.campaignId) : prev.campaignId,
            results: {
              ...prev.results,
              run: { runId: r.runId != null ? String(r.runId) : prev.results.run?.runId, campaignId: r.campaignId ?? prev.results.run?.campaignId },
            },
          }));
          return;
        }
        if (d.data == null) return;
        setState((prev) => {
          const next = { ...prev.results } as LiveWorkspaceBuildState["results"];
          if (d.key === "research") next.research = d.data as LiveResearch;
          else if (d.key === "campaign") next.campaign = d.data as LiveCampaign;
          else if (d.key === "landing") next.landing = d.data as LiveLanding;
          else if (d.key === "funnel") next.funnel = d.data as LiveFunnel;
          else if (d.key === "content") next.content = d.data as LiveContentItem[];
          else if (d.key === "ads") next.ads = d.data as LiveAd[];
          else if (d.key === "emails") next.emails = d.data as LiveEmailStep[];
          else if (d.key === "lead_capture") next.lead_capture = d.data as LiveLeadCapture;
          else if (d.key === "analytics") next.analytics = d.data as LiveAnalytics;
          else if (d.key === "approvals") next.approvals = d.data as LiveApproval[];
          else if (d.key === "logs") next.logs = d.data as { lines: Array<{ id: string; level: string; message: string; at: string }> };
          const pulseKey = String(d.key);
          return {
            ...prev,
            results: next,
            modulePulseAt: { ...prev.modulePulseAt, [pulseKey]: Date.now() },
          };
        });
        return;
      }
      if (event === "done") {
        const d = payload as { runId?: string; campaignId?: string | null; reviewUrl?: string | null; status?: string };
        setState((prev) => ({
          ...prev,
          active: false,
          runId: d.runId != null ? String(d.runId) : prev.runId,
          campaignId: d.campaignId != null ? String(d.campaignId) : prev.campaignId,
          reviewUrl: d.reviewUrl ? String(d.reviewUrl) : prev.reviewUrl,
          finalStatus: d.status ? String(d.status) : prev.finalStatus,
        }));
        return;
      }
      if (event === "error") {
        const d = payload as { key?: string; message?: string };
        setState((prev) => ({
          ...prev,
          active: false,
          errors: [...prev.errors, { key: d.key, message: d.message ?? "Error" }],
        }));
      }
    },
    [updateStep],
  );

  const pumpSse = React.useCallback(
    async (res: Response, signal: AbortSignal) => {
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buf = "";
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        for (;;) {
          const idx = buf.indexOf("\n\n");
          if (idx < 0) break;
          const block = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!block) continue;
          const { event, data } = parseSseBlock(block);
          if (data) ingestEvent(event, data);
        }
      }
    },
    [ingestEvent],
  );

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, active: false }));
  }, []);

  const reset = React.useCallback(() => {
    cancel();
    setState({
      active: false,
      steps: initialSteps(),
      results: initialResults(),
      modulePulseAt: {},
      runId: null,
      campaignId: null,
      reviewUrl: null,
      finalStatus: null,
      errors: [],
    });
  }, [cancel]);

  const start = React.useCallback(
    async (input: LiveWorkspaceBuildInput, opts?: { preserveResults?: boolean }) => {
      cancel();
      const ac = new AbortController();
      abortRef.current = ac;

      if (!opts?.preserveResults) {
        setState({
          active: true,
          steps: initialSteps(),
          results: initialResults(),
          modulePulseAt: {},
          runId: null,
          campaignId: null,
          reviewUrl: null,
          finalStatus: null,
          errors: [],
        });
      } else {
        setState((s) => ({
          ...s,
          active: true,
          steps: initialSteps(),
          errors: [],
          finalStatus: null,
          reviewUrl: null,
        }));
      }

      const res = await fetch("/api/workspace/live-build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: input.url.trim().startsWith("http") ? input.url.trim() : `https://${input.url.trim()}`,
          goal: input.goal,
          audience: input.audience,
          trafficSource: input.trafficSource,
          provider: input.provider ?? "hybrid",
          approvalMode: input.approvalMode ?? "auto_draft",
          mode: input.mode ?? "affiliate",
        }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        setState((s) => ({
          ...s,
          active: false,
          errors: [...s.errors, { message: `Live build failed (${res.status})` }],
        }));
        return;
      }

      await pumpSse(res, ac.signal);
      abortRef.current = null;
    },
    [cancel, pumpSse],
  );

  const resume = React.useCallback(
    async (runId: string, opts?: { preserveResults?: boolean }) => {
      cancel();
      const ac = new AbortController();
      abortRef.current = ac;

      if (!opts?.preserveResults) {
        setState({
          active: true,
          steps: initialSteps(),
          results: initialResults(),
          modulePulseAt: {},
          runId,
          campaignId: null,
          reviewUrl: null,
          finalStatus: null,
          errors: [],
        });
      } else {
        setState((s) => ({
          ...s,
          active: true,
          steps: initialSteps(),
          runId,
          errors: [],
          finalStatus: null,
        }));
      }

      const res = await fetch("/api/workspace/live-build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        setState((s) => ({
          ...s,
          active: false,
          errors: [...s.errors, { message: `Resume failed (${res.status})` }],
        }));
        return;
      }
      await pumpSse(res, ac.signal);
      abortRef.current = null;
    },
    [cancel, pumpSse],
  );

  React.useEffect(() => () => cancel(), [cancel]);

  const progress = liveWorkspaceProgress(state.steps);

  const regenerateSection = React.useCallback(
    async (section: "research" | "campaign" | "landing" | "funnel" | "content" | "ads" | "emails") => {
      const rid = runIdRef.current;
      if (!rid) throw new Error("No run");
      const res = await fetch("/api/workspace/regenerate-section", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: rid, campaignId: campaignIdRef.current ?? undefined, section }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; message?: string };
      if (!res.ok) throw new Error(j?.message ?? "Regenerate failed");
      await resume(rid, { preserveResults: true });
    },
    [resume],
  );

  return { state, progress, start, resume, cancel, reset, regenerateSection, hintStep };
}
