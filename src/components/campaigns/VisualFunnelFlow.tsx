"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type VisualFunnelStep = {
  id: string;
  step_index: number;
  name: string;
  step_type: string;
  slug: string;
};

export type VisualFunnelFlowProps = {
  steps: VisualFunnelStep[];
  /** When set, each step opens the public funnel step preview. */
  campaignId?: string;
  className?: string;
};

export function VisualFunnelFlow({ steps, campaignId, className }: VisualFunnelFlowProps) {
  const ordered = React.useMemo(
    () => [...steps].sort((a, b) => a.step_index - b.step_index),
    [steps],
  );

  if (ordered.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-primary/30 bg-primary/[0.06] px-4 py-8 text-center text-sm text-muted-foreground",
          "animate-pulse",
          className,
        )}
      >
        AI is generating your funnel steps…
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border/50 bg-muted/20 p-4 md:p-5", className)}>
      <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:thin] [scrollbar-color:hsl(var(--primary)/0.35)_transparent]">
        <div className="flex min-w-max items-center gap-1 pr-2">
          {ordered.map((s, idx) => {
            const stepNo = idx + 1;
            const title = `Step ${stepNo} ${s.name}`.trim();
            const href =
              campaignId && s.slug ? `/f/${campaignId}/${encodeURIComponent(s.slug)}` : null;

            const body = (
              <>
                <div className="text-sm font-semibold leading-snug tracking-tight text-foreground">{title}</div>
                <div className="mt-1 font-mono text-[11px] leading-tight text-muted-foreground">{s.step_type}</div>
              </>
            );

            const shellClass = cn(
              "relative z-[1] min-w-[148px] max-w-[220px] shrink-0 rounded-lg border px-3.5 py-3 text-left",
              "border-border/80 bg-gradient-to-b from-card to-card/80 shadow-sm",
              "transition-[border-color,box-shadow] duration-200",
              "hover:border-primary/50 hover:shadow-[0_0_22px_-8px_hsl(var(--primary)/0.55)]",
              href && "cursor-pointer",
            );

            return (
              <React.Fragment key={s.id}>
                {href ? (
                  <Link href={href} className={cn(shellClass, "block no-underline text-inherit")}>
                    {body}
                  </Link>
                ) : (
                  <div className={shellClass}>{body}</div>
                )}
                {idx < ordered.length - 1 ? (
                  <span
                    className="mx-0.5 shrink-0 select-none text-base font-extralight text-primary/60"
                    aria-hidden
                  >
                    →
                  </span>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
