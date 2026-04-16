"use client";

import Link from "next/link";

import { Check } from "lucide-react";

import { HoverLift } from "@/components/marketing/motion-primitives";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PricingTierCard({
  name,
  priceLabel,
  description,
  bullets,
  featured,
}: {
  name: string;
  priceLabel: string;
  description: string;
  bullets: string[];
  featured?: boolean;
}) {
  return (
    <HoverLift className="h-full">
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 shadow-sm backdrop-blur-md transition-colors md:p-8",
          featured
            ? "border-primary/40 bg-gradient-to-b from-primary/15 via-card to-card shadow-xl shadow-primary/15 dark:from-primary/12 dark:shadow-primary/20"
            : "border-border/70 bg-card/70 hover:border-primary/25 dark:border-white/[0.08] dark:bg-card/45",
        )}
      >
        {featured ? (
          <div className="absolute right-4 top-4">
            <Badge className="bg-primary/20 text-xs font-semibold text-primary">Most popular</Badge>
          </div>
        ) : null}
        <div className="pr-16">
          <h3 className="font-display text-xl font-bold tracking-tight">{name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground">{priceLabel}</div>
        <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-muted-foreground">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="size-3" aria-hidden />
              </span>
              <span className="leading-snug">{b}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/book"
          className={buttonVariants({
            className: "mt-8 w-full font-semibold",
            variant: featured ? "default" : "outline",
            size: "lg",
          })}
        >
          Book audit
        </Link>
      </div>
    </HoverLift>
  );
}
