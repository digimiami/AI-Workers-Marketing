"use client";

import Link from "next/link";

import {
  Bot,
  LayoutDashboard,
  Puzzle,
  Quote,
  Sparkles,
  Store,
  Workflow,
} from "lucide-react";

import { ConversionCtaBanner, ConversionCtas } from "@/components/conversion-ctas";
import { FaqSection } from "@/components/faq-section";
import { PricingSection } from "@/components/pricing-section";
import { Reveal, Tilt } from "@/components/marketing/motion-primitives";
import { SectionHeader } from "@/components/marketing/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getAgentIcon } from "@/lib/agent-icons";
import {
  AGENT_MARKETPLACE_PREVIEW,
  HOMEPAGE_FAQ,
  HOMEPAGE_TESTIMONIALS,
} from "@/lib/catalog";
import { AGENTS_SITE_TAGLINE } from "@/lib/constants";
import { agentPublicPath } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function AgentsHomeHero() {
  return (
    <section className="relative overflow-hidden fx-grid-bg">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[min(100vw,640px)] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/35 via-violet-600/20 to-cyan-400/25 blur-3xl" />
      </div>
      <div className="relative mkt-page py-16 md:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal className="space-y-6">
            <Badge className="border-primary/30 bg-primary/10 text-foreground">
              <Sparkles className="mr-1.5 inline size-3.5 text-primary" aria-hidden />
              Agent Ecosystem
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              <span className="text-gradient-fx">{AGENTS_SITE_TAGLINE}</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Hire specialist AI workers for social, YouTube, email, SEO, ads, ecommerce, support, research, content,
              and sales—coordinated from one Mission Control dashboard.
            </p>
            <ConversionCtas />
          </Reveal>
          <Reveal delay={0.08}>
            <Tilt maxTilt={5} className="relative">
              <div className="rounded-2xl border border-white/10 bg-card/70 p-6 shadow-2xl backdrop-blur-xl fx-inner-border">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <span className="text-xs font-semibold text-muted-foreground">Mission Control · Live</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    6 agents active
                  </span>
                </div>
                <div className="mt-4 space-y-2 font-mono text-[11px]">
                  {["Social Media", "SEO", "Email", "Ads"].map((name) => (
                    <div
                      key={name}
                      className="flex justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2"
                    >
                      <span>{name}</span>
                      <span className="text-primary">running</span>
                    </div>
                  ))}
                </div>
              </div>
            </Tilt>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function AgentsOverviewSection() {
  const highlights = [
    { icon: Bot, title: "Specialist workers", desc: "One agent, one job—no generic chatbot sprawl." },
    { icon: Workflow, title: "Orchestrated handoffs", desc: "Research → content → distribution in one OS." },
    { icon: LayoutDashboard, title: "Mission Control", desc: "Assign tasks, approve outputs, read unified analytics." },
    { icon: Puzzle, title: "Skills marketplace", desc: "Install capabilities like apps—per agent or fleet-wide." },
  ];

  return (
    <section className="border-t border-border/50">
      <div className="mkt-page">
        <SectionHeader
          eyebrow="AI Workers"
          title="A workforce, not a single assistant"
          description="Each worker is trained for a business function with skills, guardrails, and reporting you can trust."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((h, i) => (
            <Reveal key={h.title} delay={i * 0.05}>
              <div className="h-full rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-md dark:border-white/[0.08]">
                <h.icon className="size-8 text-primary" aria-hidden />
                <h3 className="mt-3 font-display font-bold">{h.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{h.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/mission-control" className={buttonVariants({ variant: "outline" })}>
            Explore Mission Control
          </Link>
        </div>
      </div>
    </section>
  );
}

export function AgentMarketplacePreview() {
  return (
    <section className="border-t border-border/50 bg-muted/10">
      <div className="mkt-page">
        <SectionHeader
          eyebrow="Marketplace"
          title="Agent marketplace preview"
          description="Pick a worker that matches your bottleneck. Each page includes skills, workflow, pricing, and CTAs."
          action={
            <Link href="/agents/social-media-agent" className={buttonVariants({ variant: "outline" })}>
              Browse all agents
            </Link>
          }
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {AGENT_MARKETPLACE_PREVIEW.map((a, i) => {
            const Icon = getAgentIcon(a.iconKey);
            return (
              <Reveal key={a.slug} delay={i * 0.03}>
                <Link
                  href={agentPublicPath(a.slug)}
                  className={cn(
                    "group flex h-full flex-col rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur-md",
                    "transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 dark:border-white/[0.08]",
                  )}
                >
                  <Icon className="size-7 text-primary" aria-hidden />
                  <h3 className="mt-3 font-display text-sm font-bold group-hover:text-primary">{a.title}</h3>
                  <p className="mt-1 flex-1 text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                  <ul className="mt-3 space-y-1">
                    {a.skills.map((s) => (
                      <li key={s} className="text-[10px] text-muted-foreground">
                        · {s}
                      </li>
                    ))}
                  </ul>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function MissionControlPreview() {
  const panels = [
    "Connected agents roster",
    "Task assignment queue",
    "Workflow automation builder",
    "Analytics dashboard",
    "Agent collaboration threads",
    "Notifications center",
    "Reporting exports",
  ];

  return (
    <section className="border-t border-border/50">
      <div className="mkt-page">
        <SectionHeader
          eyebrow="Mission Control"
          title="Command center for your AI workforce"
          description="See every agent, assign work, approve outputs, and measure impact—without tab chaos."
        />
        <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <ul className="space-y-3">
              {panels.map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-4 py-3 text-sm"
                >
                  <LayoutDashboard className="size-4 text-primary" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card/80 to-background/60 p-6 backdrop-blur-xl">
              <div className="aspect-video rounded-xl border border-border/50 bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
                Dashboard preview · tasks · workflows · KPIs
              </div>
              <Link href="/mission-control" className={buttonVariants({ className: "mt-6 w-full" })}>
                Tour Mission Control
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function SkillsMarketplacePreview() {
  return (
    <section className="border-t border-border/50 bg-muted/10">
      <div className="mkt-page">
        <SectionHeader
          eyebrow="Skills"
          title="Skills marketplace preview"
          description="Extend any worker with installable skills—searchable, rated, and ready to deploy."
          action={
            <Link href="/skills" className={buttonVariants({ variant: "outline" })}>
              Open marketplace
            </Link>
          }
        />
        <div className="mt-10 flex flex-wrap gap-3">
          {["Content Writer Pro", "SEO Audit Engine", "Ads Creative Lab", "Workflow Orchestrator"].map((name) => (
            <span
              key={name}
              className="rounded-full border border-border/60 bg-card/50 px-4 py-2 text-sm backdrop-blur-md"
            >
              <Store className="mr-2 inline size-4 text-primary" aria-hidden />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection() {
  return (
    <section className="border-t border-border/50">
      <div className="mkt-page">
        <SectionHeader eyebrow="Social proof" title="Teams shipping with AI workers" />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {HOMEPAGE_TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.06}>
              <blockquote className="h-full rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-md dark:border-white/[0.08]">
                <Quote className="size-8 text-primary/50" aria-hidden />
                <p className="mt-4 text-sm leading-relaxed text-foreground/90">&ldquo;{t.quote}&rdquo;</p>
                <footer className="mt-4 text-xs text-muted-foreground">
                  <strong className="text-foreground">{t.name}</strong> · {t.role}
                </footer>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AgentsHomePage() {
  return (
    <>
      <AgentsHomeHero />
      <AgentsOverviewSection />
      <AgentMarketplacePreview />
      <MissionControlPreview />
      <SkillsMarketplacePreview />
      <PricingSection />
      <TestimonialsSection />
      <FaqSection items={HOMEPAGE_FAQ} />
      <section className="border-t border-border/50">
        <div className="mkt-page pb-20">
          <ConversionCtaBanner />
        </div>
      </section>
    </>
  );
}
