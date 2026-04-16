import Link from "next/link";

import { Cpu } from "lucide-react";

import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { PublicShell } from "@/components/marketing/PublicShell";
import { Reveal } from "@/components/marketing/motion-primitives";
import { WorkerFlowStrip } from "@/components/marketing/worker-flow-strip";
import { WorkerMarketCard } from "@/components/marketing/worker-market-card";
import { buttonVariants } from "@/components/ui/button";
import { WORKERS } from "@/lib/workersCatalog";

export default function AiWorkersPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Modular workforce"
        title="Eight workers. One orchestration layer."
        description="Each role is purpose-built for marketing execution—research, funnel architecture, content, video, publishing, nurture, on-site conversion, and performance analysis. Configure, schedule, approve, and audit without losing control."
        motif={
          <div className="flex size-24 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-lg shadow-primary/20 md:size-28">
            <Cpu className="size-12 md:size-14" aria-hidden />
          </div>
        }
      >
        <Link href="/demo" className={buttonVariants({ size: "lg", className: "btn-primary-cta" })}>
          Run demo
        </Link>
        <Link href="/book" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Book audit
        </Link>
      </PageHero>

      <div className="mkt-page space-y-12 pb-8 md:space-y-14">
        <Reveal>
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold tracking-tight">How workers chain together</h2>
            <p className="mkt-prose text-sm text-muted-foreground md:text-base">
              Opportunity signal feeds the funnel build, which unlocks content and publishing, which feeds nurture and
              conversion analytics—always with human gates where risk is high.
            </p>
            <WorkerFlowStrip />
          </div>
        </Reveal>

        <div>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Worker roster</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
                Deep-dive inputs, outputs, KPIs, and tool contracts on each profile.
              </p>
            </div>
            <Link href="/how-it-works" className={buttonVariants({ variant: "outline", className: "shrink-0" })}>
              Architecture
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WORKERS.map((w) => (
              <WorkerMarketCard key={w.key} worker={w} />
            ))}
          </div>
        </div>
      </div>

      <PageCloseCta
        title="Want this workforce on your stack?"
        description="We help you wire campaigns, approvals, and telemetry—then tune workers against your real conversion data."
      />
    </PublicShell>
  );
}
