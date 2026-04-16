import * as React from "react";

import { cn } from "@/lib/utils";

export function PageHero({
  eyebrow,
  title,
  description,
  children,
  className,
  align = "left",
  motif,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "center";
  motif?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-border/50",
        "bg-gradient-to-b from-primary/[0.07] via-transparent to-transparent",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl md:h-96 md:w-96",
          align === "center" && "left-1/2 -translate-x-1/2 right-auto",
        )}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div
          className={cn(
            "flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between",
            align === "center" && "items-center text-center",
          )}
        >
          <div className={cn("max-w-2xl space-y-4", align === "center" && "mx-auto")}>
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            ) : null}
            <h1 className="font-display text-4xl font-bold tracking-tight text-balance md:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
              {title}
            </h1>
            {description ? (
              <p className="text-base leading-relaxed text-muted-foreground text-pretty md:text-lg md:leading-relaxed">
                {description}
              </p>
            ) : null}
            {children ? <div className="flex flex-wrap gap-3 pt-2">{children}</div> : null}
          </div>
          {motif ? (
            <div className="flex shrink-0 justify-center lg:justify-end lg:pt-2">{motif}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
