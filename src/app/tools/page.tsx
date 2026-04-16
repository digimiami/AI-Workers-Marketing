import Link from "next/link";

import { Gauge, Wrench } from "lucide-react";

import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { PublicShell } from "@/components/marketing/PublicShell";
import { HoverLift } from "@/components/marketing/motion-primitives";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tools = [
  { slug: "hook-generator", title: "Hook generator", desc: "Scroll-stopping hooks tuned to platform constraints." },
  { slug: "cta-generator", title: "CTA generator", desc: "Variants per funnel step with tone controls." },
  { slug: "offer-angle-generator", title: "Offer angle generator", desc: "Fresh angles for proven offers." },
  { slug: "funnel-grader", title: "Funnel grader", desc: "Score structure, friction, and clarity." },
  { slug: "landing-page-grader", title: "Landing page grader", desc: "Actionable feedback on hero, proof, CTA." },
];

export default function ToolsPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Lead magnets"
        title="Lightweight tools on the same event layer."
        description="Each micro-tool feeds the same analytics and agent substrate—ideal for top-of-funnel capture without standing up a separate stack."
        motif={
          <div className="flex size-24 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-lg md:size-28">
            <Wrench className="size-11 md:size-12" aria-hidden />
          </div>
        }
      />

      <div className="mkt-page grid gap-5 pb-12 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <HoverLift key={t.slug}>
            <Card className="h-full border-border/70 bg-card/70 backdrop-blur-md transition-colors hover:border-primary/30 dark:border-white/[0.08] dark:bg-card/50">
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Gauge className="size-5" aria-hidden />
                </div>
                <CardTitle className="font-display text-lg">{t.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
                <p className="leading-relaxed">{t.desc}</p>
                <Link href="/demo" className={buttonVariants({ variant: "outline", className: "w-full font-semibold" })}>
                  Open via demo
                </Link>
              </CardContent>
            </Card>
          </HoverLift>
        ))}
      </div>

      <PageCloseCta title="Bundle tools into a campaign?" />
    </PublicShell>
  );
}
