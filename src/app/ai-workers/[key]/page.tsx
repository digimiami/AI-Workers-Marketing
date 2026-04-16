import Link from "next/link";
import { notFound } from "next/navigation";

import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { PublicShell } from "@/components/marketing/PublicShell";
import { WorkerIcon } from "@/components/marketing/worker-icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkerByKey, WORKERS } from "@/lib/workersCatalog";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return WORKERS.map((w) => ({ key: w.key }));
}

export default function WorkerDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  return (
    <PublicShell>
      <WorkerDetailInner params={params} />
    </PublicShell>
  );
}

const cardClass =
  "border-border/70 bg-card/70 shadow-sm backdrop-blur-md dark:border-white/[0.08] dark:bg-card/50";

async function WorkerDetailInner({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const worker = getWorkerByKey(key);
  if (!worker) return notFound();

  return (
    <>
      <PageHero
        eyebrow="AI worker"
        title={worker.name}
        description={worker.tagline}
        motif={
          <div className="flex size-24 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-lg md:size-28">
            <WorkerIcon workerKey={worker.key} className="size-12 md:size-14" />
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="font-semibold">
            OpenClaw-ready
          </Badge>
          <Badge variant="outline" className="border-primary/30 font-semibold text-primary">
            Human gates supported
          </Badge>
        </div>
        <Link href="/book" className={buttonVariants({ size: "lg", className: "btn-primary-cta" })}>
          Activate / configure
        </Link>
        <Link href="/demo" className={buttonVariants({ size: "lg", variant: "outline" })}>
          See demo
        </Link>
      </PageHero>

      <div className="mkt-page space-y-8 pb-12">
        <div className="grid gap-5 md:grid-cols-2">
          <Card className={cn(cardClass)}>
            <CardHeader>
              <CardTitle className="font-display text-lg">Inputs</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              <ul className="space-y-2">
                {worker.inputs.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className={cn(cardClass)}>
            <CardHeader>
              <CardTitle className="font-display text-lg">Outputs</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              <ul className="space-y-2">
                {worker.outputs.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className={cn(cardClass)}>
            <CardHeader>
              <CardTitle className="font-display text-lg">KPIs influenced</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              <ul className="space-y-2">
                {worker.kpis.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className={cn(cardClass)}>
            <CardHeader>
              <CardTitle className="font-display text-lg">Tools</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              <ul className="space-y-2">
                {worker.tools.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className={cn(cardClass, "border-primary/20 bg-gradient-to-br from-primary/10 via-card/80 to-card/60")}>
          <CardHeader>
            <CardTitle className="font-display text-xl">Automation flow</CardTitle>
            <p className="text-sm text-muted-foreground">Structured steps this worker performs inside orchestration.</p>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-5">
              {worker.flow.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            <p className="mt-6 rounded-xl border border-border/50 bg-background/50 p-4 text-sm dark:border-white/[0.06]">
              Enable/disable, approvals, schedules, and run history live in{" "}
              <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/admin/ai-workers">
                Admin → AI Workers
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>

      <PageCloseCta title="Add this worker to your operating cadence?" />
    </>
  );
}
