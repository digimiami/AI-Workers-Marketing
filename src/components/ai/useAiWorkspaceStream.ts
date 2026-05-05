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
  lead_capture: "Leads",
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

export type AiWorkspaceThinkingLine = {
  id: string;
  step: string;
  message: string;
  at: number;
};

export type AiWorkspaceStreamState = {
  steps: Array<{ key: StreamStepKey; label: string; status: StreamStepStatus; message?: string }>;
  results: AiWorkspaceResults;
  /** Monotonic clock ticks when a module result payload updates (for glow / emphasis). */
  modulePulseAt: Partial<Record<string, number>>;
  /** Step messages from the stream (reasoning / status narration). */
  thinking: AiWorkspaceThinkingLine[];
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

/** Live SSE `type` (includes `leads`) → results / timeline key */
function normalizeLiveTypeToModule(m: string): string {
  if (m === "leads") return "lead_capture";
  return m;
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

const LIVE_TYPE_TO_STEP: Partial<Record<string, StreamStepKey>> = {
  research: "research",
  campaign: "campaign",
  landing: "landing",
  funnel: "funnel",
  content: "content",
  ads: "ads",
  emails: "emails",
  leads: "lead_capture",
  analytics: "analytics",
  approvals: "approvals",
};

function attachStreamListeners(
  es: EventSource,
  setState: React.Dispatch<React.SetStateAction<AiWorkspaceStreamState>>,
  updateStep: (step: string, status: StreamStepStatus, message?: string) => void,
  onClosed: () => void,
) {
  es.addEventListener("step", (ev) => {
    try {
      const d = JSON.parse((ev as MessageEvent).data) as {
        type?: string;
        status?: string;
        payload?: unknown;
        step?: string;
        message?: string;
      };

      if (typeof d.type === "string" && (d.status === "start" || d.status === "complete")) {
        const sk = LIVE_TYPE_TO_STEP[d.type];
        if (sk && BUILD_STEP_KEYS.includes(sk)) {
          if (d.status === "start") {
            updateStep(sk, "running", "AI is building…");
            setState((prev) => ({
              ...prev,
              thinking: [
                ...prev.thinking.slice(-160),
                {
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  step: sk,
                  message: `Starting ${STEP_LABELS[sk]}…`,
                  at: Date.now(),
                },
              ],
            }));
          }
          if (d.status === "complete" && d.payload != null) {
            const mod = normalizeLiveTypeToModule(d.type);
            const nk = normalizeModuleKey(mod);
            if (nk && nk !== "run") {
              setState((prev) => ({
                ...prev,
                results: { ...prev.results, [nk]: d.payload },
                modulePulseAt: { ...prev.modulePulseAt, [nk]: Date.now() },
              }));
            }
          }
        }
        if (!d.step) return;
      }

      if (typeof d.step !== "string" || typeof d.status !== "string") return;

      const legacyStep = d.step;
      updateStep(legacyStep, d.status as StreamStepStatus, d.message);
      const msg = typeof d.message === "string" ? d.message.trim() : "";
      if (!msg) return;
      setState((prev) => {
        const last = prev.thinking[prev.thinking.length - 1];
        if (last && last.step === legacyStep && last.message === msg) return prev;
        const line: AiWorkspaceThinkingLine = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          step: legacyStep,
          message: msg,
          at: Date.now(),
        };
        return { ...prev, thinking: [...prev.thinking.slice(-160), line] };
      });
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
          const cid =
            runData.campaign_id != null
              ? String(runData.campaign_id)
              : runData.campaignId != null
                ? String(runData.campaignId)
                : prev.campaignId;
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
          modulePulseAt: { ...prev.modulePulseAt, [nk]: Date.now() },
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
      onClosed();
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
      onClosed();
    }
  });
}

export function useAiWorkspaceStream() {
  const esRef = React.useRef<EventSource | null>(null);
  const lastInputRef = React.useRef<AiWorkspaceStreamInput | null>(null);
  const runIdRef = React.useRef<string | null>(null);

  const [state, setState] = React.useState<AiWorkspaceStreamState>(() => ({
    steps: initialSteps(),
    results: {},
    modulePulseAt: {},
    thinking: [],
    runId: null,
    reviewUrl: null,
    campaignId: null,
    finalStatus: null,
    errors: [],
    active: false,
  }));

  React.useEffect(() => {
    runIdRef.current = state.runId;
  }, [state.runId]);

  const reset = React.useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    lastInputRef.current = null;
    setState({
      steps: initialSteps(),
      results: {},
      modulePulseAt: {},
      thinking: [],
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

  const updateStep = React.useCallback((step: string, status: StreamStepStatus, message?: string) => {
    const sk = step as StreamStepKey;
    if (!BUILD_STEP_KEYS.includes(sk)) return;
    setState((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.key === sk ? { ...s, status, message } : s)),
    }));
  }, []);

  const start = React.useCallback(
    (input: AiWorkspaceStreamInput, options?: { preserveResults?: boolean }) => {
      lastInputRef.current = input;
      esRef.current?.close();
      esRef.current = null;

      const preserve = options?.preserveResults ?? false;
      const url = normalizeUrl(input.url);

      if (!preserve) {
        setState({
          steps: initialSteps(),
          results: {},
          modulePulseAt: {},
          thinking: [],
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

      const es = new EventSource(`/api/workspace/stream?${qs.toString()}`);
      esRef.current = es;
      attachStreamListeners(es, setState, updateStep, () => {
        if (esRef.current === es) esRef.current = null;
      });
    },
    [updateStep],
  );

  const resume = React.useCallback(
    (runId: string, options?: { preserveResults?: boolean }) => {
      lastInputRef.current = null;
      esRef.current?.close();
      esRef.current = null;

      const preserve = options?.preserveResults ?? false;
      if (!preserve) {
        setState({
          steps: initialSteps(),
          results: {},
          modulePulseAt: {},
          thinking: [],
          runId,
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
          runId,
          errors: [],
          finalStatus: null,
          reviewUrl: null,
          active: true,
        }));
      }

      const qs = new URLSearchParams({ runId });
      const es = new EventSource(`/api/workspace/stream?${qs.toString()}`);
      esRef.current = es;
      attachStreamListeners(es, setState, updateStep, () => {
        if (esRef.current === es) esRef.current = null;
      });
    },
    [updateStep],
  );

  const retry = React.useCallback(() => {
    const last = lastInputRef.current;
    if (last) {
      start(last, { preserveResults: true });
      return;
    }
    const rid = runIdRef.current;
    if (rid) resume(rid, { preserveResults: true });
  }, [start, resume]);

  React.useEffect(() => () => cancel(), [cancel]);

  return { state, start, resume, cancel, reset, retry };
}
