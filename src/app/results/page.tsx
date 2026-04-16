import Link from "next/link";

import { BarChart3 } from "lucide-react";

import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { PublicShell } from "@/components/marketing/PublicShell";
import { Reveal } from "@/components/marketing/motion-primitives";
import { StatMetricCard } from "@/components/marketing/stat-metric-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const metrics = [
  { title: "Campaigns", value: "—", hint: "Active + archived" },
  { title: "Content published", value: "—", hint: "Last 30 days" },
  { title: "Leads captured", value: "—", hint: "Forms + chat" },
  { title: "Clicks", value: "—", hint: "Affiliate + UTM" },
  { title: "Conversions", value: "—", hint: "Attributed" },
  { title: "Active workers", value: "8", hint: "Roles enabled" },
  { title: "Recent runs", value: "—", hint: "OpenClaw history" },
  { title: "Errors (24h)", value: "—", hint: "Alerts" },
];

export default function ResultsPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Telemetry"
        title="Public results surface—operator grade."
        description="A dashboard-style snapshot for stakeholders. Admin includes deeper breakdowns, logs, and approval trails tied to the same events."
        motif={
          <div className="flex size-24 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-lg md:size-28">
            <BarChart3 className="size-11 md:size-12" aria-hidden />
          </div>
        }
      >
        <Link href="/admin" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Operator login
        </Link>
      </PageHero>

      <div className="mkt-page space-y-10 pb-12">
        <Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => (
              <StatMetricCard key={m.title} label={m.title} value={m.value} hint={m.hint} />
            ))}
          </div>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/70 bg-card/70 backdrop-blur-md dark:border-white/[0.08] dark:bg-card/50">
            <CardHeader>
              <CardTitle className="font-display text-lg">Charts</CardTitle>
              <p className="text-sm text-muted-foreground">
                Recharts visualizations activate once seed data and analytics ingestion are connected—same schema as
                admin.
              </p>
            </CardHeader>
            <CardContent className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
              Chart canvas placeholder
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/70 backdrop-blur-md dark:border-white/[0.08] dark:bg-card/50">
            <CardHeader>
              <CardTitle className="font-display text-lg">Case study previews</CardTitle>
              <p className="text-sm text-muted-foreground">
                Internal test campaigns surface here first for credibility without exposing private client data.
              </p>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Start with{" "}
              <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/case-study/semrush-test">
                Semrush AI Visibility Test
              </Link>
              —full narrative, metrics framing, and worker involvement documented for investors.
            </CardContent>
          </Card>
        </div>
      </div>

      <PageCloseCta />
    </PublicShell>
  );
}
