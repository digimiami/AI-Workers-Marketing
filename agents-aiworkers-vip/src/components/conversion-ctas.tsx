"use client";

import Link from "next/link";

import { Calendar, Mail, Rocket } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  MAIN_APP_BOOK,
  MAIN_APP_CONTACT,
  MAIN_APP_SIGNUP,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

type ConversionCtasProps = {
  className?: string;
  size?: "default" | "compact";
  align?: "start" | "center";
};

export function ConversionCtas({
  className,
  size = "default",
  align = "start",
}: ConversionCtasProps) {
  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap",
        align === "center" && "sm:justify-center",
        className,
      )}
    >
      <Link
        href={MAIN_APP_SIGNUP}
        className={buttonVariants({
          size: isCompact ? "default" : "lg",
          className: cn(
            "min-h-10 font-semibold shadow-lg shadow-primary/25",
            !isCompact && "min-w-[180px]",
          ),
        })}
      >
        <Rocket className="size-4" aria-hidden />
        Start free trial
      </Link>
      <Link
        href={MAIN_APP_BOOK}
        className={buttonVariants({
          size: isCompact ? "default" : "lg",
          variant: "outline",
          className: cn(
            "border-primary/30 bg-background/50 backdrop-blur-sm",
            !isCompact && "min-w-[160px]",
          ),
        })}
      >
        <Calendar className="size-4" aria-hidden />
        Book demo
      </Link>
      <Link
        href={MAIN_APP_CONTACT}
        className={buttonVariants({
          size: isCompact ? "default" : "lg",
          variant: "secondary",
          className: cn("border border-border/60", !isCompact && "min-w-[150px]"),
        })}
      >
        <Mail className="size-4" aria-hidden />
        Contact sales
      </Link>
    </div>
  );
}

export function ConversionCtaBanner({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card/80 to-violet-600/10 p-8 md:p-12",
        "shadow-2xl shadow-primary/10 backdrop-blur-xl fx-inner-border",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden
        style={{
          background:
            "radial-gradient(600px 320px at 20% 0%, oklch(0.72 0.14 195 / 0.2), transparent 55%), radial-gradient(500px 280px at 100% 100%, oklch(0.65 0.2 278 / 0.15), transparent 50%)",
        }}
      />
      <div className="relative mx-auto max-w-2xl text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Deploy your first AI worker today
        </h2>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          14-day free trial · Mission Control included · Cancel anytime
        </p>
        <div className="mt-8 flex justify-center">
          <ConversionCtas align="center" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Already on AiWorkers?{" "}
          <Link href="/mission-control" className="text-primary hover:underline">
            Open Mission Control
          </Link>
        </p>
      </div>
    </section>
  );
}
