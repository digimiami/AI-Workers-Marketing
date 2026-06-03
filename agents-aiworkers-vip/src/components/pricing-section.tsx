import Link from "next/link";

import { Check } from "lucide-react";

import { ConversionCtas } from "@/components/conversion-ctas";
import { Reveal } from "@/components/marketing/motion-primitives";
import { SectionHeader } from "@/components/marketing/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AGENTS_PRICING_TIERS } from "@/lib/pricing";
import { MAIN_APP_SIGNUP } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function PricingSection() {
  return (
    <section className="border-t border-border/50 bg-muted/10" id="pricing">
      <div className="mkt-page">
        <SectionHeader
          eyebrow="Pricing"
          title="Hire workers on your timeline"
          description="Start with one specialist or deploy a full workforce. Every tier includes Mission Control and approval guardrails."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {AGENTS_PRICING_TIERS.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 0.06}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border p-6 backdrop-blur-xl",
                  tier.featured
                    ? "border-primary/40 bg-gradient-to-b from-primary/10 to-card/80 shadow-xl shadow-primary/15"
                    : "border-border/60 bg-card/50 dark:border-white/[0.08]",
                )}
              >
                {tier.featured ? (
                  <Badge className="absolute -top-3 left-6 border-primary/40 bg-primary/15 text-foreground">
                    Most popular
                  </Badge>
                ) : null}
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{tier.name}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">{tier.price}</span>
                  {tier.period ? (
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{tier.description}</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {tier.bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-sm text-foreground/90">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href={MAIN_APP_SIGNUP}
                  className={buttonVariants({
                    className: cn("mt-8 w-full", tier.featured && "btn-primary-cta"),
                    variant: tier.featured ? "default" : "outline",
                  })}
                >
                  Start free trial
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <ConversionCtas align="center" size="compact" />
        </div>
      </div>
    </section>
  );
}
