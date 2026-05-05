"use client";

import { AiGeneratedResults } from "@/components/workspace/AiGeneratedResults";
import type { LiveWorkspaceBuildState } from "@/hooks/useLiveWorkspaceBuild";

export function AiWorkspaceFullGrid(props: {
  state: LiveWorkspaceBuildState;
  organizationId: string;
  campaignId: string | null;
  runId: string | null;
  onRegenerate: (section: "research" | "campaign" | "landing" | "funnel" | "content" | "ads" | "emails") => void;
}) {
  return (
    <AiGeneratedResults
      state={props.state}
      organizationId={props.organizationId}
      campaignId={props.campaignId}
      runId={props.runId}
      onRegenerate={props.onRegenerate}
      layout="grid"
    />
  );
}
