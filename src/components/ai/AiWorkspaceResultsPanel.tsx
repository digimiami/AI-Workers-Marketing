"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { AiWorkspaceResults } from "@/components/ai/useAiWorkspaceStream";
import {
  AdsCard,
  AnalyticsCard,
  ApprovalCard,
  CampaignCard,
  ContentCard,
  EmailCard,
  FunnelCard,
  LandingCard,
  LeadCaptureCard,
  ResearchCard,
} from "@/components/ai/workspace";

export function AiWorkspaceResultsPanel(props: { results: AiWorkspaceResults; campaignId: string | null }) {
  const { results, campaignId } = props;
  const cid =
    campaignId ??
    (typeof results.campaign === "object" && results.campaign && "id" in (results.campaign as object)
      ? String((results.campaign as { id?: string }).id ?? "")
      : null);

  const nodes: React.ReactNode[] = [];
  const push = (key: string, el: React.ReactElement | null) => {
    if (!el) return;
    nodes.push(
      <motion.div key={key} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {el}
      </motion.div>,
    );
  };

  push("research", results.research ? <ResearchCard data={results.research} /> : null);
  push("campaign", results.campaign ? <CampaignCard data={results.campaign} campaignId={cid} /> : null);
  push("landing", results.landing ? <LandingCard data={results.landing} campaignId={cid} /> : null);
  push("funnel", results.funnel ? <FunnelCard data={results.funnel} campaignId={cid} /> : null);
  push("content", results.content ? <ContentCard data={results.content} campaignId={cid} /> : null);
  push("ads", results.ads ? <AdsCard data={results.ads} campaignId={cid} /> : null);
  push("emails", results.emails ? <EmailCard data={results.emails} campaignId={cid} /> : null);
  push("lead", results.leadCapture ? <LeadCaptureCard data={results.leadCapture} /> : null);
  push("analytics", results.analytics ? <AnalyticsCard data={results.analytics} /> : null);
  push("approvals", results.approvals ? <ApprovalCard data={results.approvals} campaignId={cid} /> : null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Live workspace</h2>
        <span className="text-xs text-muted-foreground">{nodes.length ? `${nodes.length} modules` : "Waiting for results…"}</span>
      </div>
      <AnimatePresence mode="popLayout">
        <div className="grid gap-4 sm:grid-cols-2">{nodes}</div>
      </AnimatePresence>
      {nodes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
          Results appear here as each step completes — nothing to show yet.
        </p>
      ) : null}
    </div>
  );
}
