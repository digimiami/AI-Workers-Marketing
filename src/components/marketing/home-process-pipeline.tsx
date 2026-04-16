"use client";

import * as React from "react";

import {
  ChevronRight,
  Compass,
  GitBranch,
  LineChart,
  PenLine,
  Send,
} from "lucide-react";

import { Reveal } from "@/components/marketing/motion-primitives";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Discover",
    desc: "Score angles & offers before you spend.",
    Icon: Compass,
  },
  {
    title: "Architect",
    desc: "Funnel maps, pages, CTAs—guardrailed.",
    Icon: GitBranch,
  },
  {
    title: "Produce",
    desc: "Hooks, scripts, assets on cadence.",
    Icon: PenLine,
  },
  {
    title: "Publish",
    desc: "Ship, track links, grow the list.",
    Icon: Send,
  },
  {
    title: "Measure",
    desc: "Runs, KPIs, next best tests.",
    Icon: LineChart,
  },
] as const;

function StepCard({ s, i }: { s: (typeof STEPS)[number]; i: number }) {
  return (
    <Reveal delay={i * 0.06} className="w-full min-w-0 sm:max-w-[220px] lg:max-w-none lg:flex-1">
      <div
        className={cn(
          "group relative h-full rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm backdrop-blur-md transition-colors",
          "fx-inner-border hover:border-primary/35 hover:shadow-md hover:shadow-primary/10 dark:border-white/[0.08] dark:bg-card/50",
        )}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 fx-holo-edge group-hover:opacity-100"
          aria-hidden
        />
        <div className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <s.Icon className="size-5" aria-hidden />
        </div>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-primary/90">Step {i + 1}</p>
        <h3 className="font-display text-base font-bold tracking-tight">{s.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
      </div>
    </Reveal>
  );
}

export function HomeProcessPipeline() {
  const nodes: React.ReactNode[] = [];
  STEPS.forEach((s, i) => {
    nodes.push(<StepCard key={s.title} s={s} i={i} />);
    if (i < STEPS.length - 1) {
      nodes.push(
        <div
          key={`arrow-${i}`}
          className="relative flex shrink-0 items-center justify-center text-primary/35 lg:px-0.5"
          aria-hidden
        >
          <span className="pointer-events-none absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-[1px]" />
          <ChevronRight className="size-5 rotate-90 lg:rotate-0" />
        </div>,
      );
    }
  });

  return (
    <div>
      <p className="mb-6 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground lg:text-left">
        Connected workers · operator control · measurable throughput
      </p>
      <div className="relative flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center lg:flex-nowrap lg:justify-between">
        <div className="pointer-events-none absolute left-8 right-8 top-[22px] hidden h-px lg:block" aria-hidden>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
          <div className="mt-[-1px] h-px w-full bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent fx-shimmer" />
        </div>
        {nodes}
      </div>
    </div>
  );
}
