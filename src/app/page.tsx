import Link from "next/link";

import { HomeComparison } from "@/components/marketing/home-comparison";
import { HomeFinalCta } from "@/components/marketing/home-final-cta";
import { HomeFlywheel } from "@/components/marketing/home-flywheel";
import { HomeHero } from "@/components/marketing/home-hero";
import { HomeProcessPipeline } from "@/components/marketing/home-process-pipeline";
import { HomeResultsPreview } from "@/components/marketing/home-results-preview";
import { HomeShiftSection } from "@/components/marketing/home-shift-section";
import { Reveal } from "@/components/marketing/motion-primitives";
import { SectionHeader } from "@/components/marketing/section-header";
import { StatMetricCard } from "@/components/marketing/stat-metric-card";
import { WorkerMarketCard } from "@/components/marketing/worker-market-card";
import { PublicShell } from "@/components/marketing/PublicShell";
import { buttonVariants } from "@/components/ui/button";
import { WORKERS, type WorkerKey } from "@/lib/workersCatalog";

const CORE_PATH: WorkerKey[] = ["opportunity-scout", "funnel-architect", "content-strategist"];

export default function Home() {
  const core = new Set(CORE_PATH);
  const orderedWorkers = [
    ...CORE_PATH.map((k) => WORKERS.find((w) => w.key === k)!),
    ...WORKERS.filter((w) => !core.has(w.key)),
  ];

  return (
    <PublicShell>
      <HomeHero />

      <HomeShiftSection />

      <section className="border-t border-border/50 bg-muted/10">
        <div className="mkt-page">
          <SectionHeader
            eyebrow="Pipeline"
            title="A connected operating flow (not a feature list)"
            description="Workers feed the next step: discover opportunities, build the funnel, generate content, capture + nurture leads, then optimize from telemetry."
            action={
              <Link href="/how-it-works" className={buttonVariants({ variant: "outline", className: "shrink-0" })}>
                Explore the architecture
              </Link>
            }
          />
          <div className="mt-10">
            <HomeProcessPipeline />
          </div>
        </div>
      </section>

      <section className="border-t border-border/50">
        <div className="mkt-page">
          <SectionHeader
            eyebrow="Workforce"
            title="An AI workforce operating system for growth"
            description="Modular workers. Approval gates. Shared telemetry. Replace fragmented execution with connected workflows you can run internally or deliver to clients."
            action={
              <Link href="/ai-workers" className={buttonVariants({ variant: "outline", className: "shrink-0" })}>
                View the workforce
              </Link>
            }
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {orderedWorkers.map((w) => (
              <WorkerMarketCard key={w.key} worker={w} emphasis={core.has(w.key) ? "featured" : "default"} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 bg-muted/10">
        <div className="mkt-page">
          <SectionHeader
            eyebrow="Telemetry"
            title="Proof of operational leverage"
            description="Throughput you can measure: launches, content shipped, leads captured, conversions tracked, and optimization loops tied back to worker runs."
            action={
              <Link href="/results" className={buttonVariants({ className: "shrink-0" })}>
                Open executive view
              </Link>
            }
          />
          <Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatMetricCard
                label="Campaigns"
                value="1"
                hint="Seeded workspace ready for expansion"
                trend="+pipeline"
              />
              <StatMetricCard
                label="Content"
                value="Queue"
                hint="Draft → review → publish with approvals"
                trend="on track"
              />
              <StatMetricCard
                label="Leads"
                value="Capture"
                hint="Forms + nurture handoff to workers"
                trend="stable"
              />
              <StatMetricCard
                label="Clicks"
                value="Tracked"
                hint="Affiliate redirects + event stream"
                trend="instrumented"
              />
            </div>
          </Reveal>
          <div className="mt-8">
            <HomeResultsPreview />
          </div>
        </div>
      </section>

      <HomeComparison />

      <HomeFlywheel />

      <section className="border-t border-border/50">
        <div className="mkt-page pb-16 pt-12 md:pb-20 md:pt-16">
          <HomeFinalCta />
        </div>
      </section>
    </PublicShell>
  );
}
