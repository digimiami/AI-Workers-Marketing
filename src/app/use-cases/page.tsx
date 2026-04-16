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
      "Turn traffic into booked calls with a connected funnel → capture → nurture flow, tuned for seasonal demand.",
    workers: "Funnel Architect → Lead Nurture → Conversion Worker",
    iconKey: "building",
  },
  {
    title: "Realtors",
    summary:
      "Listing funnels + follow-up sequences with approvals for compliance, without losing speed or consistency.",
    workers: "Content Strategist → Publishing → Nurture",
    iconKey: "home",
  },
  {
    title: "Med spas",
    summary:
      "Offer testing with guardrails, education content, and appointment-first conversion paths measured end-to-end.",
    workers: "Opportunity Scout → Funnel Architect → Analyst",
    iconKey: "stethoscope",
  },
  {
    title: "E-commerce",
    summary:
      "Angle discovery → creative output → CRO loops, tied to click/cart telemetry for faster iteration cycles.",
    workers: "Scout → Content → Analyst",
    iconKey: "shopping",
  },
  {
    title: "SaaS",
    summary:
      "Demo funnels + trial nurture + activation content coordinated across channels with measurable pipeline impact.",
    workers: "Funnel Architect → Nurture → Conversion",
    iconKey: "layers",
  },
  {
    title: "Coaches & consultants",
    summary:
      "Authority engines (webinars/workshops) plus nurture that moves prospects from curiosity to calendar—on cadence.",
    workers: "Content → Video → Nurture",
    iconKey: "graduation",
  },
];

export default function UseCasesPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="System deployments"
        title="One operating system. Many growth motions."
        description="Industries differ. The system stays consistent: connected workers, approval gates, and telemetry loops that turn execution into learning."
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
          Run demo
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
          title="Deploy the system to your motion"
          description="We map your offer, funnel, worker roles, approvals, and telemetry—then run weekly optimization cycles with your team."
          primary={{ href: "/book", label: "Book audit" }}
          secondary={{ href: "/pricing", label: "View pricing" }}
        />
      </div>

      <PageCloseCta />
    </PublicShell>
  );
}
