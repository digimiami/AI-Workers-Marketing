import Link from "next/link";

import { BookOpen, Filter, Mail, Newspaper, Tag } from "lucide-react";

import { CtaBanner } from "@/components/marketing/cta-banner";
import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { PublicShell } from "@/components/marketing/PublicShell";
import { HoverLift } from "@/components/marketing/motion-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const categories = [
  {
    slug: "ai-marketing",
    title: "AI marketing",
    desc: "Systems, prompts, orchestration patterns, and measurement for AI-led growth teams.",
  },
  {
    slug: "funnels",
    title: "Funnels",
    desc: "Landing and bridge architecture, CTA testing, and offer sequencing that survives scrutiny.",
  },
  {
    slug: "ai-visibility",
    title: "AI visibility",
    desc: "Brand demand, discoverability, and authority plays in an AI-mediated search landscape.",
  },
  {
    slug: "automation-playbooks",
    title: "Automation playbooks",
    desc: "Repeatable SOPs for campaigns, approvals, and telemetry you can hand to operators.",
  },
  {
    slug: "comparisons",
    title: "Comparisons",
    desc: "Tools, stacks, and delivery models—cut through vendor noise with operator-grade notes.",
  },
];

const featured = [
  {
    title: "Designing approval gates that teams actually use",
    tag: "Playbook",
    excerpt: "When to require human sign-off, how to keep velocity high, and what to log for audits.",
    href: "/resources/automation-playbooks",
  },
  {
    title: "OpenClaw orchestration for marketing operators",
    tag: "Deep dive",
    excerpt: "How we structure workers, schedules, and structured outputs without a black-box autopilot.",
    href: "/resources/ai-marketing",
  },
];

const tags = ["Orchestration", "Funnels", "Nurture", "Analytics", "Affiliate", "Compliance"];

export default function ResourcesPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Insights hub"
        title="Resources built for serious operators."
        description="Long-form guides, playbooks, and benchmarks—wired for the same events, workers, and approvals as the product. New drops ship here first."
        motif={
          <div className="flex size-24 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-lg md:size-28">
            <Newspaper className="size-11 md:size-12" aria-hidden />
          </div>
        }
      />

      <div className="mkt-page space-y-14 pb-8">
        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-xl font-bold tracking-tight md:text-2xl">Featured</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Filter className="size-3.5" aria-hidden />
              Curated for implementation teams
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {featured.map((f) => (
              <HoverLift key={f.title}>
                <Link href={f.href}>
                  <Card className="h-full border-border/70 bg-card/70 shadow-sm backdrop-blur-md transition-colors hover:border-primary/35 dark:border-white/[0.08] dark:bg-card/50">
                    <CardHeader className="space-y-3">
                      <Badge variant="secondary" className="w-fit font-semibold">
                        {f.tag}
                      </Badge>
                      <CardTitle className="font-display text-xl leading-snug">{f.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm leading-relaxed text-muted-foreground">
                      {f.excerpt}
                      <span className="mt-4 block text-sm font-semibold text-primary">Read →</span>
                    </CardContent>
                  </Card>
                </Link>
              </HoverLift>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="font-display text-xl font-bold tracking-tight md:text-2xl">Browse by category</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <HoverLift key={c.slug}>
                <Link href={`/resources/${c.slug}`}>
                  <Card className="h-full border-border/70 bg-gradient-to-b from-card/90 to-card/60 p-1 shadow-sm backdrop-blur-md transition-colors hover:border-primary/30 dark:border-white/[0.08]">
                    <CardHeader>
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <BookOpen className="size-5" aria-hidden />
                      </div>
                      <CardTitle className="font-display text-lg">{c.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm leading-relaxed text-muted-foreground">
                      {c.desc}
                      <span className="mt-3 block text-xs font-semibold text-primary">Open category →</span>
                    </CardContent>
                  </Card>
                </Link>
              </HoverLift>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-muted/15 p-6 dark:border-white/[0.08] md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-lg space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Mail className="size-4" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">Newsletter</span>
              </div>
              <h3 className="font-display text-xl font-bold tracking-tight">Ship notes for AI GTM teams</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Orchestration tips, funnel teardowns, and benchmark drops—no fluff, no third-party ads.
              </p>
            </div>
            <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
              <Input type="email" placeholder="you@company.com" className="h-11 bg-background/80" />
              <Button type="button" className="h-11 shrink-0 px-6 font-semibold">
                Join list
              </Button>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="border-primary/20 text-xs font-medium">
                <Tag className="mr-1 size-3" aria-hidden />
                {t}
              </Badge>
            ))}
          </div>
        </section>

        <CtaBanner
          title="Want content mapped to your stack?"
          description="Tell us your funnel stage and approval model—we’ll recommend the first articles to implement and measure."
          primary={{ href: "/book", label: "Book audit" }}
          secondary={{ href: "/demo", label: "Watch demo" }}
        />
      </div>

      <PageCloseCta />
    </PublicShell>
  );
}
