"use client";

import * as React from "react";

export type StreamStepKey =
  | "research"
  | "campaign"
  | "landing"
  | "funnel"
  | "content"
  | "ads"
  | "emails"
  | "lead_capture"
  | "analytics"
  | "approvals"
  | "done";

export type StreamStepStatus = "pending" | "running" | "complete" | "failed";

/** Build phases counted for progress (excludes terminal `done`). */
export const AI_WORKSPACE_BUILD_STEP_COUNT = 10;

const BUILD_STEP_KEYS: StreamStepKey[] = [
  "research",
  "campaign",
  "landing",
  "funnel",
  "content",
  "ads",
  "emails",
  "lead_capture",
  "analytics",
  "approvals",
  "done",
];

const STEP_LABELS: Record<StreamStepKey, string> = {
  research: "Research",
  campaign: "Campaign",
  landing: "Landing",
  funnel: "Funnel",
  content: "Content",
  ads: "Ads",
  emails: "Emails",
  lead_capture: "Lead capture",
  analytics: "Analytics",
  approvals: "Approvals",
  done: "Done",
};

export type AiWorkspaceResults = {
  run?: { runId?: string; campaignId?: string | null };
  research?: unknown;
  campaign?: unknown;
  landing?: unknown;
  funnel?: unknown;
  content?: unknown;
  ads?: unknown;
  emails?: unknown;
  leadCapture?: unknown;
  analytics?: unknown;
  approvals?: unknown;
};

export type AiWorkspaceStreamState = {
  steps: Array<{ key: StreamStepKey; label: string; status: StreamStepStatus; message?: string }>;
  results: AiWorkspaceResults;
  runId: string | null;
  reviewUrl: string | null;
  campaignId: string | null;
  finalStatus: string | null;
  errors: Array<{ step?: string; message: string }>;
  active: boolean;
};

export type AiWorkspaceStreamInput = {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  provider?: "openclaw" | "internal_llm" | "hybrid";
  approvalMode?: "required" | "auto_draft";
  mode?: "affiliate" | "client";
};

function initialSteps() {
  return BUILD_STEP_KEYS.map((key) => ({
    key,
    label: STEP_LABELS[key],
    status: "pending" as StreamStepStatus,
  }));
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normalizeModuleKey(m: string): keyof AiWorkspaceResults | "run" | null {
  if (m === "lead_capture") return "leadCapture";
  if (m === "run") return "run";
  const allowed: (keyof AiWorkspaceResults)[] = [
    "research",
    "campaign",
    "landing",
    "funnel",
    "content",
    "ads",
    "emails",
    "leadCapture",
    "analytics",
    "approvals",
  ];
  if (allowed.includes(m as keyof AiWorkspaceResults)) return m as keyof AiWorkspaceResults;
  return null;
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function useAiWorkspaceStream() {
  const esRef = React.useRef<EventSource | null>(null);
  const lastInputRef = React.useRef<AiWorkspaceStreamInput | null>(null);

  const [state, setState] = React.useState<AiWorkspaceStreamState>(() => ({
    steps: initialSteps(),
    results: {},
    runId: null,
    reviewUrl: null,
    campaignId: null,
    finalStatus: null,
    errors: [],
    active: false,
  }));

  const reset = React.useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    lastInputRef.current = null;
    setState({
      steps: initialSteps(),
      results: {},
      runId: null,
      reviewUrl: null,
      campaignId: null,
      finalStatus: null,
      errors: [],
      active: false,
    });
  }, []);

  const cancel = React.useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setState((s) => ({ ...s, active: false }));
  }, []);

  const start = React.useCallback((input: AiWorkspaceStreamInput, options?: { preserveResults?: boolean }) => {
    lastInputRef.current = input;
    esRef.current?.close();
    esRef.current = null;

    const preserve = options?.preserveResults ?? false;
    const url = normalizeUrl(input.url);

    if (!preserve) {
      setState({
        steps: initialSteps(),
        results: {},
        runId: null,
        reviewUrl: null,
        campaignId: null,
        finalStatus: null,
        errors: [],
        active: true,
      });
    } else {
      setState((s) => ({
        ...s,
        steps: initialSteps(),
        errors: [],
        finalStatus: null,
        reviewUrl: null,
        active: true,
      }));
    }

    const qs = new URLSearchParams({
      url,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      provider: input.provider ?? "hybrid",
      approvalMode: input.approvalMode ?? "auto_draft",
      mode: input.mode ?? "affiliate",
    });

    const es = new EventSource(`/api/ai/workspace/stream?${qs.toString()}`);
    esRef.current = es;

    const updateStep = (step: string, status: StreamStepStatus, message?: string) => {
      const sk = step as StreamStepKey;
      if (!BUILD_STEP_KEYS.includes(sk)) return;
      setState((prev) => ({
        ...prev,
        steps: prev.steps.map((s) => (s.key === sk ? { ...s, status, message } : s)),
      }));
    };

    es.addEventListener("step", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { step: string; status: StreamStepStatus; message?: string };
        updateStep(d.step, d.status, d.message);
      } catch {
        // ignore
      }
    });

    es.addEventListener("result", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { module: string; data: unknown };
        const nk = normalizeModuleKey(d.module);
        setState((prev) => {
          if (nk === "run") {
            const runData = asRecord(d.data);
            const rid = runData.runId != null ? String(runData.runId) : prev.runId;
            const cid = runData.campaign_id != null ? String(runData.campaign_id) : runData.campaignId != null ? String(runData.campaignId) : prev.campaignId;
            return {
              ...prev,
              runId: rid,
              campaignId: cid,
              results: {
                ...prev.results,
                run: {
                  runId: rid ?? undefined,
                  campaignId: cid ?? undefined,
                },
              },
            };
          }
          if (!nk) return prev;
          return {
            ...prev,
            results: { ...prev.results, [nk]: d.data },
          };
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener("done", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as {
          runId: string;
          campaignId?: string | null;
          reviewUrl?: string | null;
          status?: string;
        };
        setState((prev) => ({
          ...prev,
          runId: d.runId ?? prev.runId,
          campaignId: d.campaignId ? String(d.campaignId) : prev.campaignId,
          reviewUrl: d.reviewUrl ? String(d.reviewUrl) : prev.reviewUrl,
          finalStatus: d.status ? String(d.status) : prev.finalStatus,
          active: false,
          steps: prev.steps.map((s) =>
            s.key === "done" ? { ...s, status: "complete" as const, message: "Workspace ready" } : s,
          ),
        }));
      } finally {
        es.close();
        esRef.current = null;
      }
    });

    es.addEventListener("error", (ev) => {
      const me = ev as MessageEvent;
      if (typeof me.data !== "string" || !me.data.trim().startsWith("{")) return;
      try {
        const d = JSON.parse(me.data) as { step?: string; message?: string };
        setState((prev) => ({
          ...prev,
          errors: [...prev.errors, { step: d.step, message: d.message ?? "Stream error" }],
          active: false,
        }));
        if (d.step) updateStep(d.step, "failed", d.message);
      } finally {
        es.close();
        esRef.current = null;
      }
    });
  }, []);

  const retry = React.useCallback(() => {
    const last = lastInputRef.current;
    if (!last) return;
    start(last, { preserveResults: true });
  }, [start]);

  React.useEffect(() => () => cancel(), [cancel]);

  return { state, start, cancel, reset, retry };
}
