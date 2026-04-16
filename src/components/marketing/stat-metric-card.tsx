"use client";

import { TrendingUp } from "lucide-react";

import { Tilt } from "@/components/marketing/motion-primitives";
import { cn } from "@/lib/utils";

export function StatMetricCard({
  label,
  value,
  hint,
  trend,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: string;
  className?: string;
}) {
  return (
    <Tilt maxTilt={3.5} perspective={1050} hoverLift={1.5}>
      <div
        className={cn(
          "group relative rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-md transition-colors",
          "fx-inner-border hover:border-primary/30 hover:shadow-md hover:shadow-primary/10 dark:border-white/[0.08] dark:bg-card/45 dark:shadow-none",
          className,
        )}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 fx-holo-edge group-hover:opacity-100"
          aria-hidden
        />
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          {trend ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="size-3" aria-hidden />
              {trend}
            </span>
          ) : null}
        </div>
        <p className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">{value}</p>
        {hint ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary/80 to-cyan-400/70"
            aria-hidden
          />
        </div>
      </div>
    </Tilt>
  );
}
