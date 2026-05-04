"use client";

import { useState } from "react";

type StepStatus = "pending" | "running" | "complete" | "failed";

const defaultSteps = [
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
].map((key) => ({
  key,
  status: "pending" as StepStatus,
  message: "",
}));

export function useAiWorkspaceStream() {
  const [steps, setSteps] = useState(defaultSteps);
  const [results, setResults] = useState<Record<string, any>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<any[]>([]);

  async function start(input: any) {
    setIsRunning(true);
    setSteps(defaultSteps);
    setResults({});
    setErrors([]);
    setReviewUrl(null);

    const res = await fetch("/api/ai/workspace/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      setIsRunning(false);
      throw new Error(await res.text());
    }

    if (!res.body) throw new Error("No stream response");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const raw of events) {
        const eventLine = raw.split("\n").find((l) => l.startsWith("event:"));
        const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));

        if (!eventLine || !dataLine) continue;

        const event = eventLine.replace("event:", "").trim();
        const data = JSON.parse(dataLine.replace("data:", "").trim());

        if (event === "step") {
          setSteps((prev) =>
            prev.map((s) =>
              s.key === data.step ? { ...s, status: data.status, message: data.message } : s,
            ),
          );
        }

        if (event === "result") {
          setResults((prev) => ({
            ...prev,
            [data.module]: data.data,
          }));
        }

        if (event === "done") {
          setReviewUrl(data.reviewUrl);
          setIsRunning(false);
        }

        if (event === "error") {
          setErrors((prev) => [...prev, data]);
          setIsRunning(false);
        }
      }
    }

    setIsRunning(false);
  }

  return {
    start,
    steps,
    results,
    isRunning,
    reviewUrl,
    errors,
  };
}

