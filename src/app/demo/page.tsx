import { DemoForm } from "@/app/demo/DemoForm";
import { PublicShell } from "@/components/marketing/PublicShell";
import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/motion-primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function DemoPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Interactive"
        title="Shape a funnel recommendation in minutes."
        description="Enter your business context and goals. The demo returns a structured funnel recommendation and logs telemetry when public lead capture is configured."
        motif={
          <div className="flex size-24 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-lg md:size-28">
            <Sparkles className="size-11 md:size-12" aria-hidden />
          </div>
        }
      />

      <div className="mkt-page pb-12">
        <Reveal>
          <Card className="border-border/70 bg-card/70 shadow-md backdrop-blur-md dark:border-white/[0.08] dark:bg-card/50">
            <CardHeader>
              <CardTitle className="font-display text-xl">Demo inputs</CardTitle>
              <p className="text-sm text-muted-foreground">
                Structured fields map cleanly to Opportunity Scout and Funnel Architect prompts.
              </p>
            </CardHeader>
            <CardContent>
              <DemoForm />
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <PageCloseCta title="Prefer we run the first audit for you?" />
    </PublicShell>
  );
}
