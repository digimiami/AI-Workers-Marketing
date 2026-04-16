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
    name: "Starter Automation",
    priceLabel: "Starter",
    description: "A working funnel, tracking baseline, and core worker templates to prove motion fast.",
    bullets: [
      "Campaign + funnel setup",
      "Lead capture + basic nurture",
      "Affiliate click tracking",
      "Core worker templates",
    ],
  },
  {
    name: "Growth Engine",
    priceLabel: "Growth",
    description: "Content and publishing throughput with optimization loops and operator approvals.",
    bullets: [
      "Content batch workflows",
      "Publishing queue + scheduling",
      "Analytics dashboard + KPIs",
      "Approval workflows for sensitive sends",
    ],
    featured: true as const,
  },
  {
    name: "Done-For-You AI Department",
    priceLabel: "DFY",
    description: "We operate your workforce weekly—new creatives, funnels, and experiments on a fixed rhythm.",
    bullets: [
      "Weekly optimization cycles",
      "New creatives + funnel iterations",
      "Email + on-site conversion assistance",
      "Dedicated reporting for stakeholders",
    ],
  },
];

const faq = [
  {
    q: "Is pricing fixed or custom?",
    a: "Packages above are positioning tiers. Final scope depends on traffic volume, approval complexity, and integrations—we align in the audit call.",
  },
  {
    q: "Can we self-host?",
    a: "Yes. The platform targets Vercel + Supabase. We can help you run internally first, then graduate to DFY delivery for clients.",
  },
  {
    q: "What approvals are supported?",
    a: "Human gates on publishing, outbound email, and high-risk copy changes—mirrored in the admin approval queue.",
  },
  {
    q: "How fast is implementation?",
    a: "Starter motions are designed to go live quickly with templates; Growth and DFY add orchestration depth and weekly iteration cadence.",
  },
];

export default function PricingPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Engagement models"
        title="Invest in leverage, not busywork."
        description="Pick the depth that matches your stage—from a working baseline you operate yourself, to a fully managed AI department that compounds weekly."
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
          Watch demo
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
