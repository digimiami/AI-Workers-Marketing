import { PublicShell } from "@/components/marketing/PublicShell";
import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/motion-primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { BookForm } from "@/app/book/BookForm";

export default function BookPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Advisory"
        title="Book a focused audit."
        description="Share what you sell and the traffic outcome you need. We map funnel structure, worker roles, approval gates, and instrumentation so your first 30 days are decisive—not exploratory."
        motif={
          <div className="flex size-24 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-lg md:size-28">
            <CalendarDays className="size-11 md:size-12" aria-hidden />
          </div>
        }
      />

      <div className="mkt-page grid gap-8 pb-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
        <Reveal>
          <Card className="border-border/70 bg-card/70 shadow-md backdrop-blur-md dark:border-white/[0.08] dark:bg-card/50">
            <CardHeader>
              <CardTitle className="font-display text-xl">Qualification</CardTitle>
              <p className="text-sm text-muted-foreground">
                We respond faster when goals, offer, and constraints are explicit.
              </p>
            </CardHeader>
            <CardContent>
              <BookForm />
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.06}>
          <Card className="border-border/70 bg-gradient-to-b from-card/90 to-muted/20 backdrop-blur-md dark:border-white/[0.08]">
            <CardHeader>
              <CardTitle className="font-display text-xl">Calendar + FAQ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/40 p-6 text-center">
                Calendar embed placeholder — wire Cal.com, Calendly, or HubSpot meetings.
              </div>
              <div className="space-y-2 rounded-xl border border-border/50 bg-background/40 p-4 dark:border-white/[0.06]">
                <div className="font-display text-sm font-semibold text-foreground">FAQ highlights</div>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Which traffic sources and affiliate models do you support?</li>
                  <li>How do approvals work before publish or send?</li>
                  <li>What telemetry do we get on day one?</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <PageCloseCta title="Not ready to book?" description="Run the demo first—we’ll still send architecture notes if you leave context above." />
    </PublicShell>
  );
}
