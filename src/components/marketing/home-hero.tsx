"use client";

import * as React from "react";

import Link from "next/link";

import { Activity, Cpu, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Reveal, Tilt } from "@/components/marketing/motion-primitives";
import { cn } from "@/lib/utils";

function CommandPanel() {
  return (
    <div
      className={cn(
        "group relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10",
        "bg-card/80 shadow-2xl shadow-black/40 backdrop-blur-xl fx-inner-border",
        "dark:bg-gradient-to-b dark:from-card dark:to-background/90",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(700px 420px at 35% 0%, oklch(0.72 0.14 195 / 0.18), transparent 60%), radial-gradient(700px 520px at 120% 40%, oklch(0.78 0.14 278 / 0.12), transparent 55%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 fx-holo-edge group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Cpu className="size-3.5 text-primary" aria-hidden />
          OpenClaw orchestration
        </div>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Live
        </span>
      </div>
      <div className="space-y-3 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
        <div className="rounded-lg border border-border/50 bg-background/50 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-foreground">
            <Activity className="size-3 text-emerald-400" aria-hidden />
            <span className="font-sans text-xs font-semibold">Run queue</span>
          </div>
          <div className="space-y-1 opacity-90">
            <div className="flex justify-between gap-2">
              <span>Funnel Architect</span>
              <span className="text-primary">running</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Content Strategist</span>
              <span className="text-muted-foreground">queued</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Analyst Worker</span>
              <span className="text-emerald-400/90">success</span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-primary/25 bg-primary/5 p-3">
          <div className="mb-1 font-sans text-xs font-semibold text-foreground">Human approval</div>
          <p className="font-sans text-[10px] leading-snug text-muted-foreground">
            High-impact outputs pause for operator sign-off before publish or send.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 font-sans text-[10px] text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
          Guardrails + audit trail on every worker run
        </div>
      </div>
    </div>
  );
}

const heroKpis = [
  { label: "Workflows shipped", value: "18", hint: "templates" },
  { label: "Time-to-launch", value: "<24h", hint: "baseline motion" },
  { label: "Approval coverage", value: "100%", hint: "high-risk gates" },
  { label: "Telemetry events", value: "1.2M", hint: "demo dataset" },
];

const credibility = [
  "Launch faster",
  "Operate leaner",
  "Learn faster",
  "Turn workflows into growth systems",
];

export function HomeHero() {
  const heroRef = React.useRef<HTMLElement | null>(null);
  const raf = React.useRef<number | null>(null);
  const last = React.useRef({ x: 0, y: 0 });

  function applyVars() {
    const el = heroRef.current;
    if (!el) return;
    const { x, y } = last.current;
    el.style.setProperty("--g1x", `${x * 18}px`);
    el.style.setProperty("--g1y", `${y * 12}px`);
    el.style.setProperty("--g2x", `${x * -14}px`);
    el.style.setProperty("--g2y", `${y * -10}px`);
    el.style.setProperty("--g3x", `${x * 10}px`);
    el.style.setProperty("--g3y", `${y * 16}px`);
  }

  function onMove(e: React.PointerEvent<HTMLElement>) {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    last.current.x = (e.clientX - r.left) / r.width - 0.5;
    last.current.y = (e.clientY - r.top) / r.height - 0.5;
    if (raf.current) return;
    raf.current = window.requestAnimationFrame(() => {
      raf.current = null;
      applyVars();
    });
  }

  function onLeave() {
    last.current = { x: 0, y: 0 };
    applyVars();
  }

  return (
    <section ref={heroRef} className="relative overflow-hidden fx-grid-bg" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-40 left-1/2 h-[520px] w-[min(100vw,640px)] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/35 via-fuchsia-500/20 to-cyan-400/25 blur-3xl"
          style={{ transform: "translate3d(calc(-50% + var(--g1x, 0px)), var(--g1y, 0px), 0)" }}
        />
        <div
          className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-gradient-to-tl from-cyan-400/20 via-violet-600/15 to-transparent blur-3xl"
          style={{ transform: "translate3d(calc(25% + var(--g2x, 0px)), var(--g2y, 0px), 0)" }}
        />
        <div
          className="absolute left-0 top-1/3 h-[360px] w-[360px] -translate-x-1/3 rounded-full bg-gradient-to-tr from-violet-600/12 via-primary/10 to-transparent blur-3xl"
          style={{ transform: "translate3d(calc(-33% + var(--g3x, 0px)), var(--g3y, 0px), 0)" }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <Reveal className="space-y-6">
            <Badge className="border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-foreground backdrop-blur-sm">
              <Sparkles className="mr-1.5 inline size-3.5 text-primary" aria-hidden />
              AI workforce operating system
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance md:text-5xl lg:text-[3.5rem]">
              <span className="text-gradient-fx">AI is not a tool.</span>{" "}
              <span className="text-foreground">It’s a leverage system.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty md:text-xl md:leading-relaxed">
              Replace manual marketing bottlenecks with <span className="font-medium text-foreground">connected AI workers</span>{" "}
              for discovery, funnels, content, lead capture, nurture, and optimization—run on cadence with{" "}
              <span className="font-medium text-foreground">approvals</span> and{" "}
              <span className="font-medium text-foreground">telemetry</span> you can defend.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/demo"
                className={buttonVariants({
                  size: "lg",
                  className: "min-h-11 min-w-[200px] px-8 text-base font-semibold shadow-lg shadow-primary/30",
                })}
              >
                Run the demo
              </Link>
              <Link
                href="/book"
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className:
                    "min-h-11 min-w-[180px] border-primary/30 bg-background/50 text-base font-semibold backdrop-blur-sm hover:bg-background/80",
                })}
              >
                Book workflow audit
              </Link>
              <Link
                href="/how-it-works"
                className={buttonVariants({
                  size: "lg",
                  variant: "secondary",
                  className: "min-h-11 border border-border/60 bg-muted/40 text-base font-medium",
                })}
              >
                See the system
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
              {heroKpis.map((k) => (
                <Tilt key={k.label} maxTilt={3} perspective={1200} hoverLift={1}>
                  <div className="group relative rounded-xl border border-border/60 bg-background/45 px-3 py-3 text-left shadow-sm backdrop-blur-md dark:border-white/[0.08] fx-inner-border">
                    <span
                      className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 fx-holo-edge group-hover:opacity-100"
                      aria-hidden
                    />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
                    <p className="font-display text-xl font-bold tracking-tight text-foreground">{k.value}</p>
                    <p className="text-[10px] text-muted-foreground">{k.hint}</p>
                  </div>
                </Tilt>
              ))}
            </div>

            <dl className="grid gap-3 pt-2 sm:grid-cols-3">
              {[
                { k: "Workers", v: "8 specialized roles", i: "Modular + schedulable" },
                { k: "Workflows", v: "End-to-end pipeline", i: "Approvals when it matters" },
                { k: "Telemetry", v: "Clicks → leads → runs", i: "Investor-grade visibility" },
              ].map((x) => (
                <div
                  key={x.k}
                  className="rounded-xl border border-border/60 bg-background/50 p-4 shadow-sm backdrop-blur-md transition-colors hover:border-primary/30 hover:bg-background/70 dark:border-white/[0.08] dark:shadow-none"
                >
                  <dt className="text-xs font-semibold uppercase tracking-wide text-primary">{x.k}</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">{x.v}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">{x.i}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={0.08} className="lg:justify-self-end">
            <div className="relative">
              <div className="pointer-events-none absolute -right-10 -top-10 hidden h-40 w-40 rounded-full bg-gradient-to-br from-cyan-400/25 via-primary/15 to-transparent blur-3xl lg:block" />
              <div className="pointer-events-none absolute -right-12 top-16 hidden h-64 w-64 rounded-full bg-primary/10 blur-3xl lg:block fx-float" />
              <div className="pointer-events-none absolute right-2 top-10 hidden h-24 w-24 rounded-full bg-white/10 blur-2xl lg:block" />
              <Tilt maxTilt={6} perspective={900} hoverLift={3} className="relative">
                <div className="relative">
                  <CommandPanel />
                  <div
                    className="pointer-events-none absolute -inset-1 rounded-[20px] opacity-60 blur-xl"
                    style={{
                      background:
                        "radial-gradient(340px 220px at 60% 20%, oklch(0.72 0.14 195 / 0.18), transparent 55%), radial-gradient(360px 240px at 30% 90%, oklch(0.78 0.14 278 / 0.12), transparent 55%)",
                    }}
                    aria-hidden
                  />
                </div>
              </Tilt>
            </div>
          </Reveal>
        </div>

        <div className="mt-12 border-t border-border/50 pt-8">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Operator thesis
          </p>
          <p className="mt-4 text-center text-xs font-medium leading-relaxed text-foreground/85">
            {credibility.join(" · ")}
          </p>
        </div>
      </div>
    </section>
  );
}
