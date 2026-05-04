"use client";

import * as React from "react";
import { motion } from "framer-motion";

import type { AiWorkspaceResults, StreamStepKey, StreamStepStatus } from "@/components/ai/useAiWorkspaceStream";
import {
  AnalyticsCard,
  CampaignCard,
  ContentCard,
  EmailCard,
  FunnelCard,
  LandingCard,
  ResearchCard,
} from "@/components/ai/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type GridModule = "research" | "campaign" | "landing" | "funnel" | "content" | "emails" | "analytics";

const MODULE_ORDER: GridModule[] = ["research", "campaign", "landing", "funnel", "content", "emails", "analytics"];

const STEP_FOR_MODULE: Record<GridModule, StreamStepKey> = {
  research: "research",
  campaign: "campaign",
  landing: "landing",
  funnel: "funnel",
  content: "content",
  emails: "emails",
  analytics: "analytics",
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function hasResearchPayload(data: unknown): boolean {
  const d = asRecord(data);
  const hooks = Array.isArray(d.hooks) ? d.hooks : [];
  const pains = Array.isArray(d.painPoints) ? d.painPoints : [];
  return Boolean(d.audience || d.offerSummary || hooks.length || pains.length);
}

function hasCampaignPayload(data: unknown): boolean {
  const d = asRecord(data);
  return Boolean(d.name || d.goal || d.audience || d.id);
}

function hasLandingPayload(data: unknown): boolean {
  const d = asRecord(data);
  return Boolean(d.headline || d.title || d.cta);
}

function hasContentPayload(data: unknown): boolean {
  const d = asRecord(data);
  const hooks = Array.isArray(d.hooksPreview) ? d.hooksPreview : [];
  const scripts = Array.isArray(d.scriptsPreview) ? d.scriptsPreview : [];
  return Boolean((typeof d.totalCount === "number" && d.totalCount > 0) || hooks.length || scripts.length || d.firstTitle);
}

function hasEmailPayload(data: unknown): boolean {
  const d = asRecord(data);
  const steps = Array.isArray(d.steps) ? d.steps : [];
  return steps.length > 0;
}

function hasFunnelPayload(data: unknown): boolean {
  const d = asRecord(data);
  const flow = Array.isArray(d.flow) ? d.flow : [];
  const steps = Array.isArray(d.steps) ? d.steps : [];
  return Boolean(flow.length || steps.length || d.flowDiagram);
}

function hasAnalyticsPayload(data: unknown): boolean {
  return data != null && typeof data === "object";
}

function GeneratingShell(props: {
  title: string;
  status: StreamStepStatus;
  children: React.ReactNode;
  glow: boolean;
}) {
  const running = props.status === "running";
  return (
    <Card
      className={cn(
        "flex h-full min-h-[140px] flex-col border-dashed border-border/70 bg-muted/10 backdrop-blur-sm transition-[box-shadow,border-color] duration-500",
        running && "animate-pulse border-primary/35",
        props.glow && "border-primary/60 shadow-[0_0_32px_-6px_rgba(56,189,248,0.55)]",
      )}
    >
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">{props.title}</CardTitle>
        <p className="text-[11px] text-muted-foreground">{running ? "AI is generating…" : "Queued for this build"}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end pt-0 text-xs text-muted-foreground">{props.children}</CardContent>
    </Card>
  );
}

export function AiWorkspaceLiveOutputGrid(props: {
  results: AiWorkspaceResults;
  steps: Array<{ key: StreamStepKey; status: StreamStepStatus; message?: string }>;
  campaignId: string | null;
  modulePulseAt: Partial<Record<string, number>>;
  className?: string;
  heading?: string;
}) {
  const { results, steps, campaignId, modulePulseAt, className, heading = "Live output" } = props;
  const stepMap = React.useMemo(() => {
    const m = new Map<StreamStepKey, StreamStepStatus>();
    for (const s of steps) m.set(s.key, s.status);
    return m;
  }, [steps]);

  const glowWindowMs = 2800;
  const [, setGlowTick] = React.useState(0);
  React.useEffect(() => {
    const fresh = MODULE_ORDER.some((mod) => {
      const t = modulePulseAt[mod] ?? 0;
      return t > 0 && Date.now() - t < glowWindowMs;
    });
    if (!fresh) return;
    const id = window.setInterval(() => setGlowTick((x) => x + 1), 320);
    return () => window.clearInterval(id);
  }, [modulePulseAt]);

  const renderModule = (mod: GridModule) => {
    const stepKey = STEP_FOR_MODULE[mod];
    const st = stepMap.get(stepKey) ?? "pending";
    const pulseAt = modulePulseAt[mod] ?? 0;
    const glow = pulseAt > 0 && Date.now() - pulseAt < glowWindowMs;

    const wrap = (inner: React.ReactNode) => (
      <motion.div
        key={mod}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={cn(
          "h-full rounded-xl transition-[box-shadow,border-color] duration-500",
          glow && "ring-2 ring-primary/45 shadow-[0_0_36px_-8px_rgba(56,189,248,0.5)]",
        )}
      >
        {inner}
      </motion.div>
    );

    switch (mod) {
      case "research":
        if (hasResearchPayload(results.research)) {
          return wrap(<ResearchCard data={results.research} />);
        }
        return wrap(
          <GeneratingShell title="Research" status={st} glow={glow}>
            Audience, pain points, and hooks will appear as the model finishes each slice.
          </GeneratingShell>,
        );
      case "campaign":
        if (hasCampaignPayload(results.campaign)) {
          return wrap(<CampaignCard data={results.campaign} campaignId={campaignId} />);
        }
        return wrap(
          <GeneratingShell title="Campaign" status={st} glow={glow}>
            Name, goal, audience, and traffic routing stream in from your brief and the strategy pass.
          </GeneratingShell>,
        );
      case "landing":
        if (hasLandingPayload(results.landing)) {
          return wrap(<LandingCard data={results.landing} campaignId={campaignId} />);
        }
        return wrap(
          <GeneratingShell title="Landing page" status={st} glow={glow}>
            Headline, subhead, and CTA copy appear as soon as the landing artifact is written.
          </GeneratingShell>,
        );
      case "funnel":
        if (hasFunnelPayload(results.funnel)) {
          return wrap(<FunnelCard data={results.funnel} campaignId={campaignId} />);
        }
        return wrap(
          <GeneratingShell title="Funnel" status={st} glow={glow}>
            Visual path: Landing → Bridge → Capture → CTA → Thank You updates as steps are provisioned.
          </GeneratingShell>,
        );
      case "content":
        if (hasContentPayload(results.content)) {
          return wrap(<ContentCard data={results.content} campaignId={campaignId} />);
        }
        return wrap(
          <GeneratingShell title="Content" status={st} glow={glow}>
            Hook list and script previews populate from generated assets.
          </GeneratingShell>,
        );
      case "emails":
        if (hasEmailPayload(results.emails)) {
          return wrap(<EmailCard data={results.emails} campaignId={campaignId} />);
        }
        return wrap(
          <GeneratingShell title="Emails" status={st} glow={glow}>
            Nurture sequence steps (subject, delay, template) stream in when the sequence is created.
          </GeneratingShell>,
        );
      case "analytics":
        if (hasAnalyticsPayload(results.analytics)) {
          return wrap(<AnalyticsCard data={results.analytics} />);
        }
        return wrap(
          <GeneratingShell title="Analytics" status={st} glow={glow}>
            Tracking readiness and link rows update as execution provisions measurement.
          </GeneratingShell>,
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{heading}</h2>
        <span className="text-[11px] text-muted-foreground">All modules · live data</span>
      </div>
      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">{MODULE_ORDER.map((m) => renderModule(m))}</div>
    </div>
  );
}
