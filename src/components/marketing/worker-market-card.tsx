"use client";

import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

import { Tilt } from "@/components/marketing/motion-primitives";
import { WorkerIcon } from "@/components/marketing/worker-icons";
import { Badge } from "@/components/ui/badge";
import type { WorkerCard } from "@/lib/workersCatalog";
import { cn } from "@/lib/utils";

export function WorkerMarketCard({
  worker,
  className,
  emphasis = "default",
}: {
  worker: WorkerCard;
  className?: string;
  emphasis?: "default" | "featured";
}) {
  const featured = emphasis === "featured";
  const kpiShow = featured ? worker.kpis.slice(0, 4) : worker.kpis.slice(0, 3);

  return (
    <Tilt
      className={cn("h-full", featured && "lg:scale-[1.01]", className)}
      maxTilt={featured ? 5 : 4}
      perspective={980}
      hoverLift={2}
    >
      <Link
        href={`/ai-workers/${worker.key}`}
        className={cn(
          "group relative flex h-full flex-col rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-md transition-colors",
          "fx-inner-border hover:border-primary/40 hover:shadow-lg dark:border-white/[0.08] dark:bg-card/45 dark:hover:shadow-primary/10",
          featured && "p-6 ring-2 ring-primary/25 dark:ring-primary/35",
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300",
            "fx-holo-edge",
            "group-hover:opacity-100",
          )}
          aria-hidden
        />
        {featured ? (
          <Badge className="mb-2 w-fit border-primary/30 bg-primary/15 text-[10px] font-bold uppercase tracking-wide text-primary">
            Core path
          </Badge>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary",
              featured ? "size-12" : "size-11",
            )}
          >
            <WorkerIcon workerKey={worker.key} className={featured ? "size-6" : "size-5"} />
          </div>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
        <h3 className="mt-4 font-display text-lg font-bold tracking-tight">{worker.name}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{worker.tagline}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {kpiShow.map((k) => (
            <Badge
              key={k}
              variant="secondary"
              className={cn("font-medium", featured ? "text-[11px]" : "text-[10px]")}
            >
              {k}
            </Badge>
          ))}
        </div>
        <span className="mt-4 inline-flex items-center text-xs font-semibold text-primary">
          View worker
          <span className="ml-1 transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </Link>
    </Tilt>
  );
}
