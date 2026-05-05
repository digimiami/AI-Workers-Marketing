"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { AdsResultCard } from "@/components/workspace/AdsResultCard";
import { AnalyticsResultCard } from "@/components/workspace/AnalyticsResultCard";
import { ApprovalsResultCard } from "@/components/workspace/ApprovalsResultCard";
import { CampaignResultCard } from "@/components/workspace/CampaignResultCard";
import { ContentResultCard } from "@/components/workspace/ContentResultCard";
import { EmailResultCard } from "@/components/workspace/EmailResultCard";
import { FunnelResultCard } from "@/components/workspace/FunnelResultCard";
import { LandingResultCard } from "@/components/workspace/LandingResultCard";
import { LeadCaptureResultCard } from "@/components/workspace/LeadCaptureResultCard";
import { ResearchResultCard } from "@/components/workspace/ResearchResultCard";
import type { LiveWorkspaceBuildState } from "@/hooks/useLiveWorkspaceBuild";
import { cn } from "@/lib/utils";

export function AiGeneratedResults(props: {
  state: LiveWorkspaceBuildState;
  organizationId: string;
  campaignId: string | null;
  runId: string | null;
  onRegenerate: (section: "research" | "campaign" | "landing" | "funnel" | "content" | "ads" | "emails") => void;
  layout?: "stack" | "grid";
  className?: string;
}) {
  const { state, campaignId, runId, onRegenerate } = props;
  const r = state.results;
  const draft = r.research?.origin === "live_preview";

  const wrap = (key: string, node: ReactNode) => {
    if (!node) return null;
    const pulse = state.modulePulseAt[key];
    const glow = typeof pulse === "number" && Date.now() - pulse < 2200;
    return (
      <motion.div
        key={key}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={cn("rounded-2xl transition-shadow duration-500", glow && "shadow-[0_0_36px_-6px_rgba(34,211,238,0.55)] ring-2 ring-cyan-400/40")}
      >
        {node}
      </motion.div>
    );
  };

  const layout = props.layout ?? "stack";
  return (
    <div
      className={cn(
        layout === "grid" ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" : "space-y-4",
        props.className,
      )}
    >
      {wrap(
        "research",
        <ResearchResultCard data={r.research} runId={runId} campaignId={campaignId} onRegenerate={() => onRegenerate("research")} />,
      )}
      {wrap("campaign", <CampaignResultCard data={r.campaign} campaignId={campaignId} onRegenerate={() => onRegenerate("campaign")} />)}
      {wrap("landing", <LandingResultCard data={r.landing} campaignId={campaignId} onRegenerate={() => onRegenerate("landing")} />)}
      {wrap("funnel", <FunnelResultCard data={r.funnel} campaignId={campaignId} onRegenerate={() => onRegenerate("funnel")} />)}
      {wrap(
        "content",
        <ContentResultCard items={r.content} campaignId={campaignId} draft={draft} onRegenerate={() => onRegenerate("content")} />,
      )}
      {wrap("ads", <AdsResultCard items={r.ads} campaignId={campaignId} draft={draft} onRegenerate={() => onRegenerate("ads")} />)}
      {wrap("emails", <EmailResultCard steps={r.emails} campaignId={campaignId} draft={draft} onRegenerate={() => onRegenerate("emails")} />)}
      {wrap("lead_capture", <LeadCaptureResultCard data={r.lead_capture} campaignId={campaignId} />)}
      {wrap("analytics", <AnalyticsResultCard data={r.analytics} campaignId={campaignId} />)}
      {wrap("approvals", <ApprovalsResultCard items={r.approvals} organizationId={props.organizationId} />)}
    </div>
  );
}
