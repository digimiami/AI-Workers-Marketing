"use client";

import { ArrowRight, Sparkles } from "lucide-react";

import { Reveal, Tilt } from "@/components/marketing/motion-primitives";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const bullets = [
  {
    title: "Leverage over labor",
    desc: "Stop scaling headcount for throughput. Deploy connected workflows that run on schedule with approvals.",
  },
  {
    title: "Systems over isolated prompts",
    desc: "Workers feed each other: discovery → funnel → content → capture → nurture → optimization loops.",
  },
  {
    title: "Compress time-to-learning",
    desc: "Launch faster, measure sooner, and iterate weekly with telemetry you can defend in a room of adults.",
  },
] as const;

export function HomeShiftSection() {
  return (
    <section className="border-t border-border/50">
      <div className="mkt-page">
        <Reveal>
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The shift</p>
              <h2 className="font-display text-2xl font-bold tracking-tight text-balance md:text-3xl">
                Marketing is moving from teams to systems.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                AI isn’t another tool in the stack. It’s a leverage system. The winners will be operators who deploy{" "}
                <span className="text-foreground font-medium">connected workflows</span>—not people collecting isolated
                prompts and hoping for consistency.
              </p>
              <div className="grid gap-3 pt-2 sm:grid-cols-3">
                {bullets.map((b) => (
                  <div key={b.title} className="rounded-2xl border border-border/60 bg-muted/10 p-4 dark:border-white/[0.08]">
                    <p className="text-xs font-semibold text-foreground">{b.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{b.desc}</p>
                  </div>
                ))}
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                You do not need more tools. You need a system.
              </p>
            </div>

            <Tilt maxTilt={5} perspective={950} hoverLift={2}>
              <div
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-md",
                  "fx-inner-border dark:border-white/[0.08] dark:bg-card/45",
                )}
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 fx-holo-edge group-hover:opacity-100"
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                      <Sparkles className="size-5" aria-hidden />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        System status
                      </p>
                      <p className="font-display text-sm font-bold tracking-tight">Workforce operating</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-semibold">
                    Connected
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { k: "Execution", v: "Scheduled runs", d: "Workers run on cadence, not when someone remembers." },
                    { k: "Control", v: "Approval gates", d: "High-impact changes pause for human sign-off." },
                    { k: "Learning", v: "Telemetry loop", d: "Clicks → leads → runs → next tests, all logged." },
                    { k: "Output", v: "Artifacts", d: "Pages, scripts, sequences, tasks—stored and reusable." },
                  ].map((x) => (
                    <div key={x.k} className="rounded-xl border border-border/50 bg-background/40 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{x.k}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{x.v}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{x.d}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-border/50 bg-muted/15 px-4 py-3">
                  <p className="text-xs font-semibold text-foreground">Operator: you</p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    Deploy workflows <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                </div>
              </div>
            </Tilt>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

