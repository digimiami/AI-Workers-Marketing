"use client";

import * as React from "react";

import { AiWorkspaceAssetDeck } from "@/components/ai/AiWorkspaceAssetDeck";
import type { AiWorkspaceResults } from "@/components/ai/useAiWorkspaceStream";

export function AiWorkspaceResultsPanel(props: {
  results: AiWorkspaceResults;
  campaignId: string | null;
  organizationId?: string | null;
}) {
  const { results, campaignId, organizationId = null } = props;
  const cid =
    campaignId ??
    (typeof results.campaign === "object" && results.campaign && "id" in (results.campaign as object)
      ? String((results.campaign as { id?: string }).id ?? "")
      : null);

  return (
    <AiWorkspaceAssetDeck
      results={results}
      campaignId={cid}
      organizationId={organizationId}
      modulePulseAt={{}}
      heading="Workspace output"
    />
  );
}
