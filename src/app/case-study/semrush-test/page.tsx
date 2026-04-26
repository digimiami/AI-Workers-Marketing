import Link from "next/link";

import { FileText } from "lucide-react";

import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { PublicShell } from "@/components/marketing/PublicShell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SemrushCaseStudyPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Case study"
        title="Semrush AI Visibility Test"
        description="Internal campaign template used to validate funnel architecture, content cadence, lead capture, affiliate tracking, and analyst feedback loops—before scaling spend."
        motif={
          <div className="flex size-24 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-lg md:size-28">
            <FileText className="size-11 md:size-12" aria-hidden />
          </div>
        }
      >
        <Link href="/demo" className={buttonVariants({ size: "lg", className: "btn-primary-cta" })}>
          Watch demo
        </Link>
        <Link href="/book" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Book audit
        </Link>
      </PageHero>

      <div className="mkt-page max-w-4xl space-y-5 pb-12">
        <Section title="Offer selected">
          Semrush (affiliate) — positioned around “AI visibility / brand search” outcomes.
        </Section>
        <Section title="Target audience">
          SaaS founders and marketers who want more inbound demand from AI search and LLM-driven discovery.
        </Section>
        <Section title="Funnel map">
          Hook page → Bridge page → Lead magnet → Email sequence → Affiliate CTA.
        </Section>
        <Section title="Content strategy">
          Daily short-form scripts (hooks, myths, frameworks), LinkedIn threads, and comparison posts with trackable
          CTAs.
        </Section>
        <Section title="Metrics snapshot">
          In progress — the dashboard surfaces clicks, leads, conversions, and worker outputs once analytics ingestion and
          seed data are connected.
        </Section>
        <Section title="Learnings">
          Documented learnings live as campaign notes and analyst recommendations in the admin dashboard.
        </Section>

        <Card className="border-border/70 bg-gradient-to-br from-primary/10 via-card/80 to-card/60 backdrop-blur-md dark:border-white/[0.08]">
          <CardHeader>
            <CardTitle className="font-display text-lg">The 4-month flywheel</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              This case study is a “Month 1” foundation run: build the Single Brain records (campaign/funnel/content),
              then connect inputs and scale automation over time.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Month 1: Foundation and chaos</li>
              <li>Month 2: Connect and learn</li>
              <li>Month 3: Scale and automate</li>
              <li>Month 4: Optimize and own</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-gradient-to-br from-primary/12 via-card/80 to-card/60 backdrop-blur-md dark:border-white/[0.08]">
          <CardHeader>
            <CardTitle className="font-display text-lg">Next step</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Want a similar test for your offer?
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/book" className={buttonVariants({ className: "btn-primary-cta" })}>
                Book audit
              </Link>
              <Link href="/pricing" className={buttonVariants({ variant: "outline" })}>
                See pricing
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <PageCloseCta title="Run your own visibility experiment?" />
    </PublicShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/70 bg-card/70 backdrop-blur-md dark:border-white/[0.08] dark:bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-relaxed text-muted-foreground">{children}</CardContent>
    </Card>
  );
}
