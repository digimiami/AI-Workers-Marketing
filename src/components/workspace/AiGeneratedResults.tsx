"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { AdsResultCard } from "@/components/workspace/AdsResultCard";
import { AdsEngineResultCard } from "@/components/workspace/AdsEngineResultCard";
import { AnalyticsResultCard } from "@/components/workspace/AnalyticsResultCard";
import { ApprovalsResultCard } from "@/components/workspace/ApprovalsResultCard";
import { CampaignResultCard } from "@/components/workspace/CampaignResultCard";
import { ContentResultCard } from "@/components/workspace/ContentResultCard";
import { EmailResultCard } from "@/components/workspace/EmailResultCard";
import { FunnelResultCard } from "@/components/workspace/FunnelResultCard";
import { LandingResultCard } from "@/components/workspace/LandingResultCard";
import { LandingVariantsResultCard } from "@/components/workspace/LandingVariantsResultCard";
import { LeadCaptureResultCard } from "@/components/workspace/LeadCaptureResultCard";
import { ResearchResultCard } from "@/components/workspace/ResearchResultCard";
import type { LiveWorkspaceBuildState } from "@/hooks/useLiveWorkspaceBuild";
import type { LiveBuildStepKey, LiveBuildStepStatus } from "@/services/workspace/liveWorkspaceTypes";
import { cn } from "@/lib/utils";

export function AiGeneratedResults(props: {
  state: LiveWorkspaceBuildState;
  organizationId: string;
  campaignId: string | null;
  runId: string | null;
  onRegenerate: (section: "research" | "campaign" | "landing" | "funnel" | "content" | "ads" | "emails") => void;
  onStreamHint?: (message: string) => void;
  layout?: "stack" | "grid";
  className?: string;
}) {
  const { state, campaignId, runId, onRegenerate } = props;
  const r = state.results;
  const draft = r.research?.origin === "live_preview";

  const stepStatus = (() => {
    const map = new Map<LiveBuildStepKey, LiveBuildStepStatus>();
    for (const s of state.steps) map.set(s.key, s.status);
    return map;
  })();

  const GeneratingCard = (p: { title: string; tone?: "cyan" | "violet" | "sky" | "fuchsia"; message?: string }) => {
    const tone = p.tone ?? "cyan";
    const ring =
      tone === "violet"
        ? "border-violet-500/25 bg-violet-500/5"
        : tone === "sky"
          ? "border-sky-500/25 bg-sky-500/5"
          : tone === "fuchsia"
            ? "border-fuchsia-500/25 bg-fuchsia-500/5"
            : "border-cyan-500/25 bg-cyan-500/5";
    return (
      <div className={cn("rounded-2xl border p-4 backdrop-blur-xl", ring)}>
        <div className="text-sm font-semibold tracking-tight">{p.title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{p.message ?? (state.active ? "Generating…" : "Pending…")}</div>
      </div>
    );
  };

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
        r.research ? (
          <ResearchResultCard data={r.research} runId={runId} campaignId={campaignId} onRegenerate={() => onRegenerate("research")} />
        ) : state.active || stepStatus.get("research") === "running" ? (
          GeneratingCard({ title: "Research", tone: "cyan", message: "Analyzing offer, audience, hooks…" })
        ) : null,
      )}
      {wrap(
        "campaign",
        r.campaign ? (
          <CampaignResultCard data={r.campaign} campaignId={campaignId} onRegenerate={() => onRegenerate("campaign")} />
        ) : state.active || stepStatus.get("campaign") === "running" ? (
          GeneratingCard({ title: "Campaign", tone: "cyan", message: "Creating campaign shell + strategy…" })
        ) : null,
      )}
      {wrap(
        "landing",
        r.landing ? (
          <LandingResultCard data={r.landing} campaignId={campaignId} onRegenerate={() => onRegenerate("landing")} />
        ) : state.active || stepStatus.get("landing") === "running" ? (
          GeneratingCard({ title: "Landing", tone: "violet", message: "Drafting headline, CTA, sections…" })
        ) : null,
      )}
      {wrap(
        "landing_variants",
        <LandingVariantsResultCard organizationId={props.organizationId} campaignId={campaignId} />,
      )}
      {wrap(
        "funnel",
        r.funnel ? (
          <FunnelResultCard data={r.funnel} campaignId={campaignId} onRegenerate={() => onRegenerate("funnel")} />
        ) : state.active || stepStatus.get("funnel") === "running" ? (
          GeneratingCard({ title: "Funnel", tone: "sky", message: "Provisioning steps + wiring CTA…" })
        ) : null,
      )}
      {wrap(
        "content",
        r.content?.length ? (
          <ContentResultCard items={r.content} campaignId={campaignId} draft={draft} onRegenerate={() => onRegenerate("content")} />
        ) : state.active || stepStatus.get("content") === "running" ? (
          GeneratingCard({ title: "Content", tone: "fuchsia", message: "Generating hooks, scripts, captions…" })
        ) : null,
      )}
      {wrap(
        "ads_engine",
        <AdsEngineResultCard
          organizationId={props.organizationId}
          campaignId={campaignId}
          active={state.active}
          onStreamHint={props.onStreamHint}
        />,
      )}
      {wrap(
        "ads",
        r.ads?.length ? (
          <AdsResultCard items={r.ads} campaignId={campaignId} draft={draft} onRegenerate={() => onRegenerate("ads")} />
        ) : state.active || stepStatus.get("ads") === "running" ? (
          GeneratingCard({ title: "Ads", tone: "cyan", message: "Drafting creatives + angles…" })
        ) : null,
      )}
      {wrap(
        "emails",
        r.emails?.length ? (
          <EmailResultCard steps={r.emails} campaignId={campaignId} draft={draft} onRegenerate={() => onRegenerate("emails")} />
        ) : state.active || stepStatus.get("emails") === "running" ? (
          GeneratingCard({ title: "Emails", tone: "cyan", message: "Writing 5-step nurture sequence…" })
        ) : null,
      )}
      {wrap(
        "lead_capture",
        r.lead_capture ? (
          <LeadCaptureResultCard data={r.lead_capture} campaignId={campaignId} />
        ) : state.active || stepStatus.get("lead_capture") === "running" ? (
          GeneratingCard({ title: "Leads", tone: "cyan", message: "Configuring capture form + handoff…" })
        ) : null,
      )}
      {wrap(
        "analytics",
        r.analytics ? (
          <AnalyticsResultCard data={r.analytics} campaignId={campaignId} />
        ) : state.active || stepStatus.get("analytics") === "running" ? (
          GeneratingCard({ title: "Analytics", tone: "cyan", message: "Initializing events + tracking link…" })
        ) : null,
      )}
      {wrap(
        "approvals",
        r.approvals?.length ? (
          <ApprovalsResultCard items={r.approvals} organizationId={props.organizationId} />
        ) : state.active || stepStatus.get("approvals") === "running" ? (
          GeneratingCard({ title: "Approvals", tone: "cyan", message: "Queuing human checkpoints…" })
        ) : null,
      )}
    </div>
  );
}
