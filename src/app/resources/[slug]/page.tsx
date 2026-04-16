import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PublicShell } from "@/components/marketing/PublicShell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORIES: Record<string, { title: string; blurb: string }> = {
  "ai-marketing": {
    title: "AI marketing",
    blurb: "Systems, prompts, orchestration patterns, and measurement for AI-led growth teams.",
  },
  funnels: {
    title: "Funnels",
    blurb: "Landing and bridge architecture, CTA testing, and offer sequencing that survives scrutiny.",
  },
  "ai-visibility": {
    title: "AI visibility",
    blurb: "Brand demand, discoverability, and authority plays in an AI-mediated search landscape.",
  },
  "automation-playbooks": {
    title: "Automation playbooks",
    blurb: "Repeatable SOPs for campaigns, approvals, and telemetry you can hand to operators.",
  },
  comparisons: {
    title: "Comparisons",
    blurb: "Tools, stacks, and delivery models—cut through vendor noise with operator-grade notes.",
  },
};

const PLACEHOLDER_POSTS = [
  "Orchestration guardrails that scale with traffic",
  "Designing approval UX operators will actually follow",
  "Benchmarking worker throughput without vanity metrics",
];

export default async function ResourceCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cat = CATEGORIES[slug];
  if (!cat) notFound();

  return (
    <PublicShell>
      <div className="border-b border-border/60 bg-muted/10">
        <div className="mkt-page space-y-6 py-12 md:py-16">
          <Link
            href="/resources"
            className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 gap-1 text-muted-foreground" })}
          >
            <ArrowLeft className="size-4" aria-hidden />
            All resources
          </Link>
          <div className="max-w-3xl space-y-4">
            <Badge variant="secondary" className="font-semibold">
              Category
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight text-balance md:text-5xl">{cat.title}</h1>
            <p className="text-lg leading-relaxed text-muted-foreground text-pretty">{cat.blurb}</p>
          </div>
        </div>
      </div>

      <div className="mkt-page space-y-8 pb-12">
        <p className="text-sm text-muted-foreground">
          Long-form posts will render from your CMS or MDX pipeline. Below are structured placeholders so navigation
          and layout stay production-grade today.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {PLACEHOLDER_POSTS.map((title, i) => (
            <Card
              key={title}
              className="border-border/70 bg-card/70 backdrop-blur-md dark:border-white/[0.08] dark:bg-card/50"
            >
              <CardHeader>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Coming soon · Part {i + 1}
                </div>
                <CardTitle className="font-display text-lg leading-snug">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Outline + metrics checklist will ship with the first editorial drop.
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <PageCloseCta title="Want editorial aligned to your funnel?" />
    </PublicShell>
  );
}
