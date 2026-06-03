import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import Link from "next/link";

import { ConversionCtaBanner, ConversionCtas } from "@/components/conversion-ctas";
import { FaqSection } from "@/components/faq-section";
import { PricingSection } from "@/components/pricing-section";
import { Reveal } from "@/components/marketing/motion-primitives";
import { SectionHeader } from "@/components/marketing/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { AgentDefinition } from "@/lib/agent-definition";
import { cn } from "@/lib/utils";

function AgentHero({ agent }: { agent: AgentDefinition }) {
  const Icon = agent.icon;
  return (
    <section className="relative overflow-hidden fx-grid-bg">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          agent.accent,
        )}
        aria-hidden
      />
      <div className="relative mkt-page pb-8 pt-16 md:pt-24">
        <Reveal className="max-w-3xl space-y-6">
          <Badge className="border-primary/30 bg-primary/10 text-foreground">
            <Sparkles className="mr-1.5 inline size-3.5 text-primary" aria-hidden />
            AI Worker
          </Badge>
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-primary/30 bg-card/60 p-4 backdrop-blur-xl">
              <Icon className="size-10 text-primary" aria-hidden />
            </div>
            <div>
              <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">{agent.title}</h1>
              <p className="mt-3 text-lg text-muted-foreground">{agent.tagline}</p>
            </div>
          </div>
          <ConversionCtas />
        </Reveal>
      </div>
    </section>
  );
}

function ProblemSolution({ agent }: { agent: AgentDefinition }) {
  return (
    <section className="border-t border-border/50">
      <div className="mkt-page">
        <div className="grid gap-8 lg:grid-cols-2">
          <Reveal>
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 backdrop-blur-md">
              <h2 className="font-display text-xl font-bold text-destructive/90">{agent.problem.title}</h2>
              <ul className="mt-4 space-y-3">
                {agent.problem.points.map((p) => (
                  <li key={p} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-destructive">×</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6 backdrop-blur-md">
              <h2 className="font-display text-xl font-bold text-primary">{agent.solution.title}</h2>
              <ul className="mt-4 space-y-3">
                {agent.solution.points.map((p) => (
                  <li key={p} className="flex gap-2 text-sm text-foreground/90">
                    <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function SkillsGrid({ agent }: { agent: AgentDefinition }) {
  return (
    <section className="border-t border-border/50 bg-muted/10">
      <div className="mkt-page">
        <SectionHeader
          eyebrow="Skills"
          title="Built-in capabilities"
          description="Every skill installs into Mission Control and runs with approvals and telemetry."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agent.skills.map((skill, i) => (
            <Reveal key={skill} delay={i * 0.04}>
              <div className="rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-md dark:border-white/[0.08]">
                <p className="font-semibold text-foreground">{skill}</p>
                <p className="mt-1 text-xs text-muted-foreground">Runs 24/7 with human gates on high-risk actions</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection({ agent }: { agent: AgentDefinition }) {
  return (
    <section className="border-t border-border/50">
      <div className="mkt-page">
        <SectionHeader eyebrow="Features" title="Enterprise-ready from day one" />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {agent.features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className="h-full rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl dark:border-white/[0.08]">
                <h3 className="font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowVisualization({ agent }: { agent: AgentDefinition }) {
  return (
    <section className="border-t border-border/50 bg-muted/10">
      <div className="mkt-page">
        <SectionHeader
          eyebrow="Workflow"
          title="How this worker operates"
          description="A repeatable loop you can inspect, approve, and optimize in Mission Control."
        />
        <div className="mt-10 flex flex-col gap-4 md:flex-row md:flex-wrap md:items-stretch md:justify-between">
          {agent.workflow.map((step, i) => (
            <Reveal key={step.step} delay={i * 0.06} className="flex-1 min-w-[140px] max-w-full md:max-w-[200px]">
              <div className="relative h-full rounded-2xl border border-primary/20 bg-card/50 p-5 backdrop-blur-md">
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 font-display font-bold">{step.step}</h3>
                <p className="mt-2 text-xs text-muted-foreground">{step.detail}</p>
                {i < agent.workflow.length - 1 ? (
                  <ArrowRight
                    className="absolute -right-3 top-1/2 hidden size-5 -translate-y-1/2 text-primary md:block"
                    aria-hidden
                  />
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitsSection({ agent }: { agent: AgentDefinition }) {
  return (
    <section className="border-t border-border/50">
      <div className="mkt-page">
        <SectionHeader eyebrow="Benefits" title="Outcomes operators care about" />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {agent.benefits.map((b, i) => (
            <Reveal key={b} delay={i * 0.04}>
              <li className="flex gap-3 rounded-xl border border-border/50 bg-background/40 px-4 py-3 backdrop-blur-sm">
                <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
                <span className="text-sm font-medium">{b}</span>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ExampleResults({ agent }: { agent: AgentDefinition }) {
  return (
    <section className="border-t border-border/50 bg-muted/10">
      <div className="mkt-page">
        <SectionHeader
          eyebrow="Results"
          title="Example outcomes"
          description="Illustrative benchmarks from pilot deployments—your results depend on ICP, offer, and approval cadence."
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {agent.results.map((r, i) => (
            <Reveal key={r.label} delay={i * 0.06}>
              <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur-xl dark:border-white/[0.08]">
                <p className="font-display text-4xl font-bold text-gradient-fx">{r.metric}</p>
                <p className="mt-2 font-semibold">{r.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function AgentLandingCta({ agent }: { agent: AgentDefinition }) {
  return (
    <section className="border-t border-border/50">
      <div className="mkt-page pb-16">
        <ConversionCtaBanner />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Deploy the {agent.shortTitle} worker alongside others in{" "}
          <Link href="/mission-control" className="text-primary hover:underline">
            Mission Control
          </Link>
        </p>
      </div>
    </section>
  );
}

export function AgentLandingPage({ agent }: { agent: AgentDefinition }) {
  return (
    <>
      <AgentHero agent={agent} />
      <ProblemSolution agent={agent} />
      <SkillsGrid agent={agent} />
      <FeaturesSection agent={agent} />
      <WorkflowVisualization agent={agent} />
      <BenefitsSection agent={agent} />
      <ExampleResults agent={agent} />
      <PricingSection />
      <FaqSection items={agent.faq} />
      <AgentLandingCta agent={agent} />
    </>
  );
}
