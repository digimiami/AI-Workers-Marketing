"use client";

import * as React from "react";

import { ChevronDown } from "lucide-react";

import { Reveal } from "@/components/marketing/motion-primitives";
import { SectionHeader } from "@/components/marketing/section-header";
import { cn } from "@/lib/utils";

export function FaqSection({
  items,
  title = "Frequently asked questions",
  description = "Everything you need to know before hiring your AI workforce.",
}: {
  items: { q: string; a: string }[];
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = React.useState<number | null>(0);

  return (
    <section className="border-t border-border/50">
      <div className="mkt-page">
        <SectionHeader eyebrow="FAQ" title={title} description={description} />
        <div className="mt-10 space-y-3">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 0.04}>
                <div
                  className={cn(
                    "rounded-2xl border border-border/60 bg-card/50 backdrop-blur-md transition-colors",
                    "dark:border-white/[0.08] dark:bg-card/40",
                    isOpen && "border-primary/30 bg-card/70",
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-foreground">{item.q}</span>
                    <ChevronDown
                      className={cn(
                        "size-5 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180 text-primary",
                      )}
                      aria-hidden
                    />
                  </button>
                  {isOpen ? (
                    <div className="border-t border-border/50 px-5 pb-4 pt-0">
                      <p className="pt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                    </div>
                  ) : null}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
