import Link from "next/link";

import { Building2, Home, Layers, ShoppingBag } from "lucide-react";

import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { PublicShell } from "@/components/marketing/PublicShell";
import { CtaBanner } from "@/components/marketing/cta-banner";
import { UseCaseMarketCard } from "@/components/marketing/use-case-market-card";
import { buttonVariants } from "@/components/ui/button";

const cases = [
  {
    title: "Local businesses",
    summary:
      "High-intent lead funnels, automated nurture, and booking CTAs tuned for service-area offers and seasonal promos.",
    workers: "Funnel Architect → Lead Nurture → Conversion Worker",
    iconKey: "building",
  },
  {
    title: "Realtors",
    summary:
      "Neighborhood narratives, listing bridges, and follow-up sequences that respect compliance while staying human.",
    workers: "Content Strategist → Publishing → Nurture",
    iconKey: "home",
  },
  {
    title: "Med spas",
    summary:
      "Offer testing with conservative claims, treatment education content, and appointment-first conversion paths.",
    workers: "Opportunity Scout → Funnel Architect → Analyst",
    iconKey: "stethoscope",
  },
  {
    title: "E-commerce",
    summary:
      "Angle discovery, UGC scripts, PDP support content, and CRO loops informed by click and cart telemetry.",
    workers: "Scout → Content → Analyst",
    iconKey: "shopping",
  },
  {
    title: "SaaS",
    summary:
      "Demo-led funnels, trial nurture, activation content, and expansion plays coordinated across channels.",
    workers: "Funnel Architect → Nurture → Conversion",
    iconKey: "layers",
  },
  {
    title: "Coaches & consultants",
    summary:
      "Authority engines—webinars, workshops, and long-form nurture that move prospects from curiosity to calendar.",
    workers: "Content → Video → Nurture",
    iconKey: "graduation",
  },
];

export default function UseCasesPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Vertical playbooks"
        title="Same workforce. Different winning motions."
        description="Campaign context, brand voice, and approval rules shift per industry—while the underlying orchestration, telemetry, and worker contracts stay consistent."
        motif={
          <div className="grid grid-cols-2 gap-2 opacity-90">
            {[Layers, Home, ShoppingBag].map((Ic, i) => (
              <div
                key={i}
                className="flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary md:size-16"
              >
                <Ic className="size-7" aria-hidden />
              </div>
            ))}
          </div>
        }
      >
        <Link href="/ai-workers" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Meet the workers
        </Link>
        <Link href="/demo" className={buttonVariants({ size: "lg", className: "btn-primary-cta" })}>
          Watch demo
        </Link>
      </PageHero>

      <div className="mkt-page space-y-10 pb-8">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <UseCaseMarketCard
              key={c.title}
              title={c.title}
              summary={c.summary}
              workers={c.workers}
              iconKey={c.iconKey}
            />
          ))}
        </div>

        <CtaBanner
          title="Done-for-you industry rollout"
          description="We map offer, funnel, content cadence, approvals, and analytics to your motion—then operate weekly optimization cycles with your team."
          primary={{ href: "/book", label: "Book audit" }}
          secondary={{ href: "/pricing", label: "View pricing" }}
        />
      </div>

      <PageCloseCta />
    </PublicShell>
  );
}
