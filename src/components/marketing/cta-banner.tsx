import * as React from "react";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Reveal } from "@/components/marketing/motion-primitives";

export function CtaBanner({
  title,
  description,
  primary,
  secondary,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  className?: string;
}) {
  return (
    <Reveal>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-primary/25",
          "bg-gradient-to-br from-primary/20 via-card to-cyan-500/10",
          "p-8 shadow-[0_0_0_1px_oklch(1_0_0_/0.06)_inset,0_32px_80px_-40px_oklch(0.55_0.2_278_/0.35)]",
          "md:p-10",
          className,
        )}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative space-y-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-balance text-gradient-fx md:text-3xl">
            {title}
          </h2>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {description}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
            <Link
              href={primary.href}
              className={buttonVariants({
                size: "lg",
                className:
                  "min-w-[180px] shadow-lg shadow-primary/25 sm:min-h-11 sm:px-8 font-semibold",
              })}
            >
              {primary.label}
            </Link>
            {secondary ? (
              <Link
                href={secondary.href}
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className:
                    "min-w-[160px] border-white/20 bg-background/40 backdrop-blur-sm hover:bg-background/60",
                })}
              >
                {secondary.label}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
