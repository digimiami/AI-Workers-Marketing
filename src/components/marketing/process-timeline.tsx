"use client";

import { Check } from "lucide-react";

import { Reveal } from "@/components/marketing/motion-primitives";
import { cn } from "@/lib/utils";

export type ProcessStep = { title: string; desc: string };

export function ProcessTimeline({ steps }: { steps: ProcessStep[] }) {
  return (
    <div className="relative">
      <ul className="grid gap-6 md:grid-cols-3 md:gap-5 lg:gap-8">
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.06}>
            <li
              className={cn(
                "relative rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm backdrop-blur-md transition-all duration-300",
                "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md dark:border-white/[0.07] dark:bg-card/50 dark:shadow-none",
                "md:flex md:flex-col md:gap-3",
              )}
            >
              <div className="mb-3 flex items-center gap-3 md:mb-0">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-primary md:mt-auto">
                <Check className="size-3.5 shrink-0" aria-hidden />
                Structured handoff to the next stage
              </div>
            </li>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
