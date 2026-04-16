import Link from "next/link";

import { CreditCard } from "lucide-react";

import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { PricingTierCard } from "@/components/marketing/pricing-tier-card";
import { PublicShell } from "@/components/marketing/PublicShell";
import { Reveal } from "@/components/marketing/motion-primitives";
import { buttonVariants } from "@/components/ui/button";

const tiers = [
  {
    name: "Baseline OS Deployment",
    priceLabel: "Starter",
    description: "Deploy the core operating flow: funnel, capture, telemetry, and the templates to ship the first motion fast.",
    bullets: [
      "Funnel + capture baseline",
      "Telemetry wiring (events + KPIs)",
      "Core worker templates + guardrails",
      "Operator runbook + approvals",
    ],
  },
  {
    name: "Throughput + Optimization OS",
    priceLabel: "Growth",
    description: "Increase throughput and learning speed with publishing cadence, nurture loops, and operator approvals.",
    bullets: [
      "Content engine + publishing cadence",
      "Nurture automation with approvals",
      "Executive dashboard + KPI definitions",
      "Weekly experiment loop + backlog",
    ],
    featured: true as const,
  },
  {
    name: "Managed Growth Operations",
    priceLabel: "DFY",
    description: "We operate the system weekly: new funnels, creatives, and experiments on a fixed cadence with reporting.",
    bullets: [
      "Weekly launches + iteration rhythm",
      "Creative + funnel + CRO execution",
      "Nurture + on-site conversion tuning",
      "Stakeholder reporting + governance",
    ],
  },
];

const faq = [
  {
    q: "Is pricing fixed or custom?",
    a: "Tiers are deployment levels. Final scope depends on traffic volume, approval complexity, integrations, and how much of the operating cadence you want managed.",
  },
  {
    q: "Can we self-host?",
    a: "Yes. The platform targets Vercel + Supabase. We can help you run internally first, then graduate to DFY delivery for clients.",
  },
  {
    q: "What approvals are supported?",
    a: "Human gates on publishing, outbound email, and high-risk copy changes—captured in the approval queue with an audit trail.",
  },
  {
    q: "How fast is implementation?",
    a: "Baseline deployments are designed to go live quickly with templates. Higher tiers add orchestration depth, telemetry loops, and a weekly iteration cadence.",
  },
];

export default function PricingPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Deployment levels"
        title="Deploy leverage at the depth you need."
        description="Start with a baseline you operate yourself, then scale into throughput + optimization loops—or hand operations to us weekly."
        motif={
          <div className="flex size-24 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-lg md:size-28">
            <CreditCard className="size-11 md:size-12" aria-hidden />
          </div>
        }
      >
        <Link href="/book" className={buttonVariants({ size: "lg", className: "btn-primary-cta" })}>
          Book audit
        </Link>
        <Link href="/demo" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Run demo
        </Link>
      </PageHero>

      <div className="mkt-page space-y-16 pb-8">
        <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {tiers.map((t) => (
            <PricingTierCard key={t.name} {...t} />
          ))}
        </div>

        <Reveal>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 md:p-8 dark:border-white/[0.08]">
            <h2 className="font-display text-xl font-bold tracking-tight md:text-2xl">FAQ</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Straight answers on how engagements typically run.
            </p>
            <dl className="mt-8 divide-y divide-border/60 border-t border-border/60">
              {faq.map((item) => (
                <div key={item.q} className="grid gap-2 py-5 md:grid-cols-[1fr_1.4fr] md:gap-8 md:py-6">
                  <dt className="text-sm font-semibold text-foreground">{item.q}</dt>
                  <dd className="text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        <p className="text-center text-sm text-muted-foreground">
          Prefer to evaluate internally first?{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/results">
            Explore the public results surface
          </Link>{" "}
          or{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/resources">
            browse resources
          </Link>
          .
        </p>
      </div>

      <PageCloseCta />
    </PublicShell>
  );
}
