import Link from "next/link";

import { ChevronRight } from "lucide-react";

import { WorkerIcon } from "@/components/marketing/worker-icons";
import { WORKERS } from "@/lib/workersCatalog";

export function WorkerFlowStrip() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-gradient-to-r from-card/80 via-card/60 to-card/80 p-4 shadow-inner backdrop-blur-md dark:border-white/[0.08]">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Default orchestration path
      </p>
      <div className="flex min-w-max items-center justify-center gap-0.5 md:min-w-0 md:flex-wrap">
        {WORKERS.map((w, i) => (
          <span key={w.key} className="flex items-center">
            {i > 0 ? (
              <ChevronRight className="mx-0.5 size-4 shrink-0 text-primary/50" aria-hidden />
            ) : null}
            <Link
              href={`/ai-workers/${w.key}`}
              className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/40 px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-background/70 dark:border-white/[0.06]"
            >
              <WorkerIcon workerKey={w.key} className="size-4 shrink-0 text-primary" />
              <span className="max-w-[140px] truncate text-xs font-semibold leading-tight">{w.name}</span>
            </Link>
          </span>
        ))}
      </div>
    </div>
  );
}
