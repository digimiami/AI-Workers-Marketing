"use client";

import { Check, X } from "lucide-react";

import { Reveal, Tilt } from "@/components/marketing/motion-primitives";
import { cn } from "@/lib/utils";

const oldWay = [
  "Hire more people to get throughput",
  "Launch slowly (handoffs + context loss)",
  "Manual follow-up and inconsistent nurture",
  "Disconnected tools and dashboards",
  "Attribution is vague and debated",
] as const;

const osWay = [
  "One operator + an AI workforce",
  "Launch in hours, iterate weekly",
  "Automated capture + nurture with approvals",
  "Connected workflows with shared telemetry",
  "Performance is measurable and auditable",
] as const;

export function HomeComparison() {
  return (
    <section className="border-t border-border/50 bg-muted/10">
      <div className="mkt-page">
        <Reveal>
          <div className="mb-8 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Execution model</p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-balance md:text-3xl">
              Stop scaling labor. Start scaling leverage.
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              The old model adds headcount and still ships slowly. AiWorkers is an operating system: connected workers,
              approvals where risk is high, and telemetry that turns execution into learning.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Tilt maxTilt={4} perspective={1050} hoverLift={2}>
              <div
                className={cn(
                  "group relative h-full overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-6 shadow-sm backdrop-blur-md",
                  "fx-inner-border dark:border-white/[0.08] dark:bg-card/45",
                )}
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 fx-holo-edge group-hover:opacity-100"
                  aria-hidden
                />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Old way</p>
                <h3 className="mt-1 font-display text-lg font-bold tracking-tight">More tools. More people. Same drag.</h3>
                <ul className="mt-4 space-y-2 text-sm">
                  {oldWay.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-muted-foreground">
                      <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <X className="size-3.5" aria-hidden />
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Tilt>

            <Tilt maxTilt={4} perspective={1050} hoverLift={2}>
              <div
                className={cn(
                  "group relative h-full overflow-hidden rounded-2xl border border-primary/25 bg-card/70 p-6 shadow-sm backdrop-blur-md",
                  "fx-inner-border dark:border-primary/35 dark:bg-card/45",
                )}
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 fx-holo-edge group-hover:opacity-100"
                  aria-hidden
                />
                <p className="text-xs font-semibold uppercase tracking-wide text-primary/90">AiWorkers way</p>
                <h3 className="mt-1 font-display text-lg font-bold tracking-tight">
                  AI workforce operating system for growth.
                </h3>
                <ul className="mt-4 space-y-2 text-sm">
                  {osWay.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-foreground/90">
                      <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-500">
                        <Check className="size-3.5" aria-hidden />
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-xl border border-border/50 bg-muted/15 px-4 py-3 text-xs text-muted-foreground">
                  Replace manual execution with orchestrated leverage.
                </div>
              </div>
            </Tilt>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

