"use client";

import Link from "next/link";
import Image from "next/image";

import { Menu } from "lucide-react";

import { useAgentsHref } from "@/components/agents-site/agents-link-context";
import { ConversionCtas } from "@/components/agents-site/conversion-ctas";
import { AGENTS_SITE_NAME } from "@/lib/agents-site/constants";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV = [
  { href: "/agents/social-media-agent", label: "Agents" },
  { href: "/mission-control", label: "Mission Control" },
  { href: "/skills", label: "Skills" },
  { href: "#pricing", label: "Pricing" },
] as const;

export function AgentsShell({ children }: { children: React.ReactNode }) {
  const href = useAgentsHref();

  return (
    <div className="dark min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/50 glass-panel">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href={href("/")} className="flex items-center gap-2">
            <Image src="/logo.svg" alt={AGENTS_SITE_NAME} width={22} height={22} priority />
            <span className="font-display text-lg font-bold tracking-tight text-gradient-fx">
              Agents<span className="text-muted-foreground font-medium">.AIWorkers</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
            <Link
              href={href("/")}
              className="rounded-lg px-3 py-1.5 transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              Home
            </Link>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href.startsWith("#") ? item.href : href(item.href)}
                className="rounded-lg px-3 py-1.5 transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Link
              href={href("/mission-control")}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Mission Control
            </Link>
            <Link href="/signup" className={buttonVariants({ size: "sm", className: "btn-primary-cta" })}>
              Free trial
            </Link>
          </div>

          <Sheet>
            <SheetTrigger
              className={buttonVariants({ variant: "outline", size: "icon", className: "md:hidden" })}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="dark w-[min(100vw,320px)] border-border/60 bg-background">
              <SheetHeader>
                <SheetTitle className="font-display text-gradient-fx">{AGENTS_SITE_NAME}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-2">
                <Link href={href("/")} className="rounded-lg px-3 py-2 hover:bg-muted">
                  Home
                </Link>
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href.startsWith("#") ? item.href : href(item.href)}
                    className="rounded-lg px-3 py-2 hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-8">
                <ConversionCtas size="compact" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 fx-atmosphere opacity-80" />
          <div className="absolute inset-0 fx-grid-bg fx-grid-fade opacity-[0.4]" />
          <div className="absolute inset-0 fx-vignette opacity-70" />
        </div>
        <div className="relative">{children}</div>
      </main>

      <footer className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="font-display text-lg font-bold text-gradient-fx">{AGENTS_SITE_NAME}</div>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Hire specialized AI workers for marketing, sales, support, and operations—coordinated through Mission
                Control.
              </p>
              <div className="mt-6">
                <ConversionCtas size="compact" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Product</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href={href("/mission-control")} className="hover:text-foreground">
                    Mission Control
                  </Link>
                </li>
                <li>
                  <Link href={href("/skills")} className="hover:text-foreground">
                    Skills Marketplace
                  </Link>
                </li>
                <li>
                  <Link href={href("/agents/social-media-agent")} className="hover:text-foreground">
                    Agent catalog
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Company</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="https://aiworkers.vip" className="hover:text-foreground">
                    AiWorkers.vip
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-foreground">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-10 text-xs text-muted-foreground">
            © {new Date().getFullYear()} AIWorkers.vip. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
