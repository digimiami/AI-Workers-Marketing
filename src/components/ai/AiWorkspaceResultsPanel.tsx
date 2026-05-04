"use client";

import * as React from "react";

import { AiWorkspaceLiveOutputGrid } from "@/components/ai/AiWorkspaceLiveOutputGrid";
import type { AiWorkspaceResults, StreamStepKey, StreamStepStatus } from "@/components/ai/useAiWorkspaceStream";

const STATIC_COMPLETE_STEPS: StreamStepKey[] = [
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

export function AiWorkspaceResultsPanel(props: { results: AiWorkspaceResults; campaignId: string | null }) {
  const { results, campaignId } = props;
  const cid =
    campaignId ??
    (typeof results.campaign === "object" && results.campaign && "id" in (results.campaign as object)
      ? String((results.campaign as { id?: string }).id ?? "")
      : null);

  const staticSteps = React.useMemo(
    () =>
      STATIC_COMPLETE_STEPS.map((key) => ({
        key,
        label: "",
        status: "complete" as StreamStepStatus,
      })),
    [],
  );

  return (
    <AiWorkspaceLiveOutputGrid
      results={results}
      steps={staticSteps}
      campaignId={cid}
      modulePulseAt={{}}
      heading="Workspace output"
    />
  );
}
