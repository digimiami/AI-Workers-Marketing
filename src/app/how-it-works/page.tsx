import Link from "next/link";

import { Workflow } from "lucide-react";

import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { ProcessTimeline } from "@/components/marketing/process-timeline";
import { PublicShell } from "@/components/marketing/PublicShell";
import { buttonVariants } from "@/components/ui/button";

const steps = [
  {
    title: "Research agent",
    desc: "Find opportunities, angles, and offers worth testing before you buy traffic.",
  },
  {
    title: "Funnel agent",
    desc: "Generate funnel maps, landing and bridge pages, and CTA variants with compliance-aware guardrails.",
  },
  {
    title: "Content agent",
    desc: "Turn approved offers into hooks, scripts, and posting plans tuned to each platform.",
  },
  {
    title: "Publishing / traffic agent",
    desc: "Queue publishing jobs, track links, and keep performance signals flowing into analytics.",
  },
  {
    title: "Lead nurture agent",
    desc: "Segment leads, assign sequences, draft emails, and send via Resend with optional approvals.",
  },
  {
    title: "Analyst agent",
    desc: "Translate events into what to scale, pause, or test next—with structured tasks for operators.",
  },
];

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Architecture"
        title="How AiWorkers.vip runs end-to-end."
        description="A multi-agent marketing pipeline built for internal affiliate testing today—and premium client delivery tomorrow. Every stage emits telemetry, supports approvals, and hands off structured outputs."
        motif={
          <div className="flex size-24 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-lg md:size-28">
            <Workflow className="size-12 md:size-14" aria-hidden />
          </div>
        }
      >
        <Link href="/demo" className={buttonVariants({ size: "lg", className: "btn-primary-cta" })}>
          Try the demo
        </Link>
        <Link href="/ai-workers" className={buttonVariants({ size: "lg", variant: "outline" })}>
          See workers
        </Link>
      </PageHero>

      <div className="mkt-page space-y-10 pb-12">
        <ProcessTimeline steps={steps} />
        <div className="rounded-2xl border border-border/60 bg-muted/15 p-6 text-sm leading-relaxed text-muted-foreground dark:border-white/[0.08] md:p-8 md:text-base">
          <p>
            <span className="font-semibold text-foreground">OpenClaw</span> sits underneath as the orchestration layer:
            schedules, run history, structured JSON outputs, memory for reuse, and human gates when outputs are
            high-risk.
          </p>
        </div>
      </div>

      <PageCloseCta />
    </PublicShell>
  );
}
