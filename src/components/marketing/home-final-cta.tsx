"use client";

import Link from "next/link";

import { Reveal } from "@/components/marketing/motion-primitives";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HomeFinalCta() {
  return (
    <Reveal>
      <div
        className={cn(
          "group relative overflow-hidden rounded-3xl border border-primary/25",
          "bg-gradient-to-br from-primary/25 via-card to-cyan-500/15",
          "px-6 py-12 text-center shadow-[0_0_0_1px_oklch(1_0_0_/0.06)_inset,0_40px_100px_-48px_oklch(0.55_0.2_278_/0.4)]",
          "md:px-12 md:py-16",
        )}
      >
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl fx-float" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl fx-float" />
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 fx-holo-edge group-hover:opacity-100"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-10 left-1/2 h-24 w-[min(520px,90%)] -translate-x-1/2 rounded-full bg-white/10 blur-2xl opacity-40"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl space-y-4">
          <h2 className="font-display text-3xl font-bold tracking-tight text-balance text-foreground md:text-4xl lg:text-[2.5rem] lg:leading-tight">
            Ready to deploy an AI workforce operating system?
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
            Replace fragmented execution with orchestrated leverage—connected workflows, approval gates, and telemetry
            that turns marketing into a measurable system.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row sm:flex-wrap">
            <Link href="/signup" className={buttonVariants({ size: "lg", className: "min-w-[220px] btn-primary-cta px-8" })}>
              Create campaign now
            </Link>
            <Link
              href="/admin"
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className: "min-w-[180px] border-white/25 bg-background/50 font-semibold backdrop-blur-sm hover:bg-background/75",
              })}
            >
              Open dashboard
            </Link>
            <Link
              href="/how-it-works"
              className={buttonVariants({
                size: "lg",
                variant: "secondary",
                className: "min-w-[160px] border border-border/60 bg-background/40 font-semibold backdrop-blur-sm",
              })}
            >
              Explore architecture
            </Link>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
