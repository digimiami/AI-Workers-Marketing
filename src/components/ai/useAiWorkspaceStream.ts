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
  | "logs"
  | "done";

export type StreamStepStatus = "pending" | "running" | "complete" | "failed";

export type AiWorkspaceStreamState = {
  steps: Array<{ key: StreamStepKey; label: string; status: StreamStepStatus; message?: string }>;
  results: Record<string, unknown>;
  runId: string | null;
  reviewUrl: string | null;
  campaignId: string | null;
  errors: Array<{ step?: string; message: string }>;
  active: boolean;
};

const DEFAULT_STEPS: Array<{ key: StreamStepKey; label: string }> = [
  { key: "research", label: "Research" },
  { key: "campaign", label: "Campaign" },
  { key: "landing", label: "Landing" },
  { key: "funnel", label: "Funnel" },
  { key: "content", label: "Content" },
  { key: "ads", label: "Ads" },
  { key: "emails", label: "Emails" },
  { key: "lead_capture", label: "Lead capture" },
  { key: "analytics", label: "Analytics" },
  { key: "approvals", label: "Approvals" },
  { key: "logs", label: "Logs" },
  { key: "done", label: "Done" },
];

export type AiWorkspaceStreamInput = {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  provider?: "openclaw" | "internal_llm" | "hybrid";
  approvalMode?: "required" | "auto_draft";
  mode?: "affiliate" | "client";
};

export function useAiWorkspaceStream() {
  const esRef = React.useRef<EventSource | null>(null);

  const [state, setState] = React.useState<AiWorkspaceStreamState>(() => ({
    steps: DEFAULT_STEPS.map((s) => ({ ...s, status: "pending" })),
    results: {},
    runId: null,
    reviewUrl: null,
    campaignId: null,
    errors: [],
    active: false,
  }));

  const reset = React.useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setState({
      steps: DEFAULT_STEPS.map((s) => ({ ...s, status: "pending" })),
      results: {},
      runId: null,
      reviewUrl: null,
      campaignId: null,
      errors: [],
      active: false,
    });
  }, []);

  const cancel = React.useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setState((s) => ({ ...s, active: false }));
  }, []);

  const start = React.useCallback((input: AiWorkspaceStreamInput) => {
    reset();

    const qs = new URLSearchParams({
      url: input.url,
      goal: input.goal,
      audience: input.audience,
      trafficSource: input.trafficSource,
      provider: input.provider ?? "hybrid",
      approvalMode: input.approvalMode ?? "auto_draft",
      mode: input.mode ?? "affiliate",
    });

    const es = new EventSource(`/api/ai/workspace/stream?${qs.toString()}`);
    esRef.current = es;
    setState((s) => ({ ...s, active: true }));

    const updateStep = (step: string, status: StreamStepStatus, message?: string) => {
      setState((prev) => ({
        ...prev,
        steps: prev.steps.map((s) => (s.key === (step as StreamStepKey) ? { ...s, status, message } : s)),
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
        setState((prev) => {
          const runId = d.module === "run" ? String((d.data as any)?.runId ?? prev.runId ?? "") : prev.runId;
          return {
            ...prev,
            runId: runId || prev.runId,
            results: { ...prev.results, [d.module]: d.data },
          };
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener("done", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { runId: string; campaignId?: string | null; reviewUrl?: string | null };
        setState((prev) => ({
          ...prev,
          runId: d.runId ?? prev.runId,
          campaignId: d.campaignId ? String(d.campaignId) : prev.campaignId,
          reviewUrl: d.reviewUrl ? String(d.reviewUrl) : prev.reviewUrl,
          active: false,
          steps: prev.steps.map((s) => (s.key === "done" ? { ...s, status: "complete" } : s)),
        }));
      } finally {
        es.close();
        esRef.current = null;
      }
    });

    es.addEventListener("error", (ev) => {
      // EventSource also fires "error" on disconnect; we only treat JSON payloads as real errors.
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
  }, [reset]);

  React.useEffect(() => () => cancel(), [cancel]);

  return { state, start, cancel, reset };
}

