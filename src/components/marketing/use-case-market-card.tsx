"use client";

import {
  Building2,
  GraduationCap,
  Home,
  Layers,
  type LucideIcon,
  ShoppingBag,
  Stethoscope,
} from "lucide-react";

import { HoverLift } from "@/components/marketing/motion-primitives";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  building: Building2,
  home: Home,
  stethoscope: Stethoscope,
  shopping: ShoppingBag,
  layers: Layers,
  graduation: GraduationCap,
};

export function UseCaseMarketCard({
  title,
  summary,
  workers,
  iconKey,
}: {
  title: string;
  summary: string;
  workers: string;
  iconKey: string;
}) {
  const Icon = ICON_MAP[iconKey] ?? Layers;

  return (
    <HoverLift className="h-full">
      <article
        className={cn(
          "flex h-full flex-col rounded-2xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur-md transition-colors",
          "hover:border-primary/35 hover:shadow-md dark:border-white/[0.08] dark:bg-card/45 dark:shadow-none",
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden />
        </div>
        <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{title}</h3>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{summary}</p>
        <p className="mt-4 border-t border-border/60 pt-4 text-xs font-medium leading-relaxed text-primary">
          Workers focus: <span className="text-foreground">{workers}</span>
        </p>
      </article>
    </HoverLift>
  );
}
